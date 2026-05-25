import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { estimateTokens } from '../session/token-estimator.js';
import type { ContextResponse } from '../types/cognition.js';
import type { ContextPack, ContextPackItem } from '../types/knowledge.js';
import { tokenize } from './ranking.js';

export function buildContextPack(
  response: ContextResponse,
  budget: number,
  rootPath?: string,
): ContextPack {
  const candidates: ContextPackItem[] = [
    ...response.relevantFiles.map((ranked) => ({
      kind: 'file' as const,
      id: ranked.item.path,
      title: ranked.item.path,
      tokenEstimate: ranked.item.tokenEstimate ?? 0,
      reasons: ranked.reasons,
      data: ranked.item,
    })),
    ...buildFileRangeCandidates(response, budget, rootPath),
    ...response.relevantSymbols.map((ranked) =>
      buildSymbolCandidate(ranked, rootPath),
    ),
    ...response.relevantCognition.map((ranked) => ({
      kind: 'atom' as const,
      id: ranked.item.id,
      title: ranked.item.title,
      tokenEstimate: estimateTokens(
        [ranked.item.title, ranked.item.summary ?? ''].join('\n'),
        `${ranked.item.id}.md`,
      ),
      reasons: ranked.reasons,
      data: ranked.item,
    })),
    ...response.relationships.map((relationship) => ({
      kind: 'relationship' as const,
      id: [
        relationship.sourceId,
        relationship.relationshipType,
        relationship.targetId,
      ].join(' -> '),
      title: `${relationship.sourceId} ${relationship.relationshipType} ${relationship.targetId}`,
      tokenEstimate: 16,
      reasons: response.relationshipExplanations?.find(
        (item) =>
          item.relationship.sourceId === relationship.sourceId &&
          item.relationship.targetId === relationship.targetId &&
          item.relationship.relationshipType === relationship.relationshipType,
      )?.reasons ?? ['related graph edge'],
      data: relationship,
    })),
    ...(response.gitChanges ?? []).map((change) => ({
      kind: 'git-change' as const,
      id: change.path,
      title: `${change.status}: ${change.path}`,
      tokenEstimate: 12,
      reasons: [change.reason],
      data: change,
    })),
  ];

  const orderedCandidates = candidates.sort(comparePackCandidates);
  const strongPaths = strongPackPaths(candidates);
  const items: ContextPackItem[] = [];
  const omitted: ContextPackItem[] = [];
  let usedTokens = 0;
  for (const candidate of orderedCandidates) {
    if (isLowSignalCandidate(candidate, strongPaths)) {
      omitted.push(candidate);
      continue;
    }
    if (usedTokens + candidate.tokenEstimate <= budget) {
      items.push(candidate);
      usedTokens += candidate.tokenEstimate;
    } else {
      omitted.push(candidate);
    }
  }

  return {
    task: response.query,
    budget,
    usedTokens,
    items,
    omitted,
    warnings: response.warnings,
  };
}

function comparePackCandidates(
  left: ContextPackItem,
  right: ContextPackItem,
): number {
  return packPriority(right) - packPriority(left);
}

function packPriority(item: ContextPackItem): number {
  let score = 0;
  if (item.kind === 'atom') score += 1000;
  if (item.kind === 'git-change') score += 900;
  if (item.kind === 'file-range') score += 800;
  if (item.kind === 'symbol') score += 300;
  if (item.kind === 'file') score += 200;
  if (item.kind === 'relationship') score += 100;
  if (item.reasons.some((reason) => reason.includes('matched atom')))
    score += 30;
  if (item.reasons.some((reason) => reason.includes('current git change')))
    score += 25;
  if (item.reasons.some((reason) => reason.includes('specific query token')))
    score += 10;
  if (
    item.reasons.some((reason) =>
      reason.includes('generic path-only match penalty'),
    )
  )
    score -= 20;
  score -= Math.floor(item.tokenEstimate / 2000);
  return score;
}

function strongPackPaths(candidates: ContextPackItem[]): Set<string> {
  const paths = new Set<string>();
  for (const candidate of candidates) {
    if (candidate.kind === 'file-range' || candidate.kind === 'git-change') {
      const pathValue = candidatePath(candidate);
      if (pathValue) paths.add(pathValue);
    }
    if (candidate.kind === 'file' && hasStrongReason(candidate)) {
      const pathValue = candidatePath(candidate);
      if (pathValue) paths.add(pathValue);
    }
    if (candidate.kind === 'atom') {
      const atom = candidate.data as { relatedFiles?: string[] } | undefined;
      for (const file of atom?.relatedFiles ?? []) paths.add(file);
    }
  }
  return paths;
}

function isLowSignalCandidate(
  candidate: ContextPackItem,
  strongPaths: Set<string>,
): boolean {
  if (strongPaths.size === 0) return false;
  if (
    candidate.kind === 'atom' ||
    candidate.kind === 'git-change' ||
    candidate.kind === 'file-range'
  ) {
    return false;
  }
  if (hasStrongReason(candidate)) return false;
  if (candidateTouchesStrongPath(candidate, strongPaths)) return false;
  return (
    candidate.kind === 'file' ||
    candidate.kind === 'symbol' ||
    candidate.kind === 'relationship'
  );
}

function hasStrongReason(candidate: ContextPackItem): boolean {
  return candidate.reasons.some(
    (reason) =>
      reason.includes('matched atom') ||
      reason.includes('current git change') ||
      reason.includes('changed in recent commits') ||
      reason.includes('unstaged change') ||
      reason.includes('staged change'),
  );
}

function candidateTouchesStrongPath(
  candidate: ContextPackItem,
  strongPaths: Set<string>,
): boolean {
  const pathValue = candidatePath(candidate);
  if (pathValue && strongPaths.has(pathValue)) return true;
  if (candidate.kind !== 'relationship') return false;
  const relationship = candidate.data as {
    sourceId?: string;
    targetId?: string;
  };
  return [...strongPaths].some(
    (strongPath) =>
      relationship.sourceId?.includes(strongPath) ||
      relationship.targetId?.includes(strongPath),
  );
}

function candidatePath(candidate: ContextPackItem): string | undefined {
  const data = candidate.data as
    | { path?: string; filePath?: string }
    | undefined;
  return data?.path ?? data?.filePath;
}

interface LineRange {
  start: number;
  end: number;
  tokens: string[];
}

const GENERIC_RANGE_TOKENS = new Set([
  'app',
  'code',
  'component',
  'file',
  'page',
  'repo',
  'work',
]);

const MAX_SYMBOL_EXCERPT_LINES = 40;

function buildSymbolCandidate(
  ranked: {
    item: {
      id: string;
      name: string;
      filePath: string;
      startLine?: number;
      endLine?: number;
    };
    reasons: string[];
  },
  rootPath: string | undefined,
): ContextPackItem {
  const symbol = ranked.item;
  let excerpt: string | undefined;
  let tokenEstimate = 20;

  if (
    rootPath &&
    symbol.startLine != null &&
    symbol.endLine != null &&
    symbol.endLine - symbol.startLine + 1 <= MAX_SYMBOL_EXCERPT_LINES
  ) {
    const fullPath = path.join(rootPath, symbol.filePath);
    if (existsSync(fullPath)) {
      try {
        const content = readFileSync(fullPath, 'utf8');
        const allLines = content.split(/\r?\n/);
        const from = symbol.startLine - 1; // 0-based
        const to = symbol.endLine; // exclusive
        excerpt = allLines.slice(from, to).join('\n');
        tokenEstimate = estimateTokens(excerpt, symbol.filePath);
      } catch {
        // best-effort; fall back to default estimate
      }
    }
  }

  return {
    kind: 'symbol' as const,
    id: symbol.id,
    title: symbol.name,
    tokenEstimate,
    reasons: ranked.reasons,
    data: excerpt != null ? { ...symbol, excerpt } : symbol,
  };
}

function buildFileRangeCandidates(
  response: ContextResponse,
  budget: number,
  rootPath?: string,
): ContextPackItem[] {
  if (!rootPath) return [];
  const queryTokens = tokenize(response.query).filter(
    (token) => token.length >= 3 && !GENERIC_RANGE_TOKENS.has(token),
  );
  if (queryTokens.length === 0) return [];

  const maxRangeTokens = Math.max(250, Math.min(1200, Math.floor(budget / 3)));
  const candidates: ContextPackItem[] = [];
  for (const rankedFile of response.relevantFiles.slice(0, 8)) {
    const file = rankedFile.item;
    const fileTokens = file.tokenEstimate ?? 0;
    if (fileTokens <= Math.max(1000, Math.floor(budget / 2))) continue;

    const fullPath = path.join(rootPath, file.path);
    if (!existsSync(fullPath)) continue;

    let content = '';
    try {
      content = readFileSync(fullPath, 'utf8');
    } catch {
      continue;
    }

    const ranges = selectQueryRanges(
      content,
      queryTokens,
      maxRangeTokens,
      file.path,
    );
    for (const range of ranges) {
      const lines = content.split(/\r?\n/).slice(range.start - 1, range.end);
      const excerpt = lines.join('\n');
      candidates.push({
        kind: 'file-range',
        id: `${file.path}:${range.start}-${range.end}`,
        title: `${file.path}:${range.start}-${range.end}`,
        tokenEstimate: estimateTokens(excerpt, file.path),
        reasons: [
          ...rankedFile.reasons,
          `range selected from oversized file`,
          `line text matched ${range.tokens.map((token) => `"${token}"`).join(', ')}`,
        ],
        data: {
          path: file.path,
          startLine: range.start,
          endLine: range.end,
          excerpt,
        },
      });
    }
  }
  return candidates;
}

function selectQueryRanges(
  content: string,
  queryTokens: string[],
  maxRangeTokens: number,
  filePath: string,
): LineRange[] {
  const lines = content.split(/\r?\n/);
  const hits: LineRange[] = [];
  for (const [index, line] of lines.entries()) {
    const lower = line.toLowerCase();
    const matched = queryTokens.filter((token) => lower.includes(token));
    if (matched.length === 0) continue;
    hits.push({
      start: Math.max(1, index + 1 - 8),
      end: Math.min(lines.length, index + 1 + 8),
      tokens: matched,
    });
  }

  const ranges = mergeRanges(hits);
  return ranges
    .sort((left, right) => right.tokens.length - left.tokens.length)
    .slice(0, 3)
    .map((range) => trimRangeToBudget(range, lines, maxRangeTokens, filePath));
}

function mergeRanges(ranges: LineRange[]): LineRange[] {
  const merged: LineRange[] = [];
  for (const range of ranges.sort((left, right) => left.start - right.start)) {
    const current = merged.at(-1);
    if (!current || range.start > current.end + 3) {
      merged.push({ ...range, tokens: [...new Set(range.tokens)] });
      continue;
    }
    current.end = Math.max(current.end, range.end);
    current.tokens = [...new Set([...current.tokens, ...range.tokens])];
  }
  return merged;
}

function trimRangeToBudget(
  range: LineRange,
  lines: string[],
  maxRangeTokens: number,
  filePath: string,
): LineRange {
  let start = range.start;
  let end = Math.min(range.end, start + 79);
  while (end > start + 4) {
    const excerpt = lines.slice(start - 1, end).join('\n');
    if (estimateTokens(excerpt, filePath) <= maxRangeTokens) break;
    end -= 5;
  }
  return { ...range, start, end };
}
