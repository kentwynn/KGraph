import type { Command } from 'commander';
import { loadConfig } from '../../config/config.js';
import { queryContext } from '../../context/context-query.js';
import { assertWorkspace } from '../../storage/kgraph-paths.js';
import { mapsExist, readMaps } from '../../storage/map-store.js';
import type { ContextResponse } from '../../types/cognition.js';
import { KGraphError, runCommand } from '../errors.js';

export function registerContextCommand(program: Command): void {
  program
    .command('context <query>')
    .description('Return compact repo context for a query')
    .option('--json', 'Print JSON output')
    .action((query: string, options: { json?: boolean }) =>
      runCommand(async () => {
        if (!query.trim()) {
          throw new KGraphError('Query cannot be empty.');
        }
        const workspace = await assertWorkspace(process.cwd());
        if (!(await mapsExist(workspace))) {
          throw new KGraphError(
            'KGraph maps are missing. Run `kgraph scan` first.',
          );
        }
        const config = await loadConfig(workspace);
        const maps = await readMaps(workspace);
        const response = await queryContext(workspace, config, maps, query);
        console.log(
          options.json
            ? JSON.stringify(response, null, 2)
            : renderContextMarkdown(response),
        );
      }),
    );
}

export function renderContextMarkdown(response: ContextResponse): string {
  const lines = [
    `KGraph Context · ${response.query}`,
    `local-first · deterministic · inspectable`,
    ``,
    `● Signal`,
    `  confidence   ${contextConfidence(response)}`,
    `  source       ${contextSources(response).join(' + ') || 'file map'}`,
    `  warnings     ${response.warnings.length > 0 ? response.warnings.length : 'none'}`,
    ``,
  ];

  lines.push('● Matched Domains', '');
  lines.push(
    ...formatList(
      response.matchedDomains.map((item) =>
        atomLine(item.item.name, formatReasons(item.reasons)),
      ),
    ),
  );
  lines.push('', '● Source', '');
  lines.push(
    ...formatList(
      limited(response.relevantFiles, 5).map((item) => {
        const f = item.item;
        const meta = [
          f.language,
          f.tokenEstimate ? `~${f.tokenEstimate} tokens` : '',
        ]
          .filter(Boolean)
          .join(', ');
        return atomLine(
          `${f.path}${meta ? ` [${meta}]` : ''}`,
          formatReasons(item.reasons),
        );
      }),
    ),
  );
  appendMore(lines, response.relevantFiles.length, 5, 'source item');
  lines.push('', '● Symbols', '');
  lines.push(
    ...formatList(
      limited(response.relevantSymbols, 6).map((item) => {
        const s = item.item;
        const kindInfo = [s.kind, s.parentName].filter(Boolean).join(', ');
        const lineRange =
          s.startLine != null && s.endLine != null
            ? `:${s.startLine}-${s.endLine}`
            : '';
        return atomLine(
          `${s.name} (${kindInfo}) in ${s.filePath}${lineRange}`,
          formatReasons(item.reasons),
        );
      }),
    ),
  );
  appendMore(lines, response.relevantSymbols.length, 6, 'symbol');
  lines.push('', '● Atoms', '');
  lines.push(
    ...formatList(
      response.relevantCognition.map(
        (item) =>
          atomLine(
            `${item.item.title} [${item.item.kind ?? 'summary'}, ${item.item.confidence ?? 'medium'}, ${item.item.referencesStatus}]`,
            formatReasons(item.reasons),
          ),
      ),
    ),
  );
  lines.push('', '● Graph', '');
  lines.push(
    ...formatGroupedRelationships(
      relevantGraphRelationships(response),
      response.relationshipExplanations,
    ),
  );
  lines.push('', '● Nearby Symbols (1-hop imports)', '');
  lines.push(
    ...formatList(
      nearbySymbolItems(response).map(({ symbol: s, reasons }) => {
        const kindInfo = [s.kind, s.parentName].filter(Boolean).join(', ');
        const lineRange =
          s.startLine != null && s.endLine != null
            ? `:${s.startLine}-${s.endLine}`
            : '';
        return atomLine(
          `${s.name} (${kindInfo}) in ${s.filePath}${lineRange}`,
          formatReasons(reasons),
        );
      }),
    ),
  );
  lines.push('', '● Stale References', '');
  lines.push(...formatList(response.staleReferences.map((ref) => `  ◌ ${ref}`)));
  lines.push('', '● Recent Git Changes', '');
  if (response.gitChanges && response.gitChanges.length > 0) {
    const staged = response.gitChanges.filter((c) => c.status === 'staged');
    const unstaged = response.gitChanges.filter((c) => c.status === 'unstaged');
    const recent = response.gitChanges.filter(
      (c) => c.status === 'recent-commit',
    );
    if (staged.length > 0) {
      lines.push('Staged:');
      for (const c of staged) lines.push(`  ● ${c.path} (${c.reason})`);
    }
    if (unstaged.length > 0) {
      lines.push('Unstaged:');
      for (const c of unstaged) lines.push(`  ● ${c.path} (${c.reason})`);
    }
    if (recent.length > 0) {
      lines.push('Recent commits:');
      for (const c of recent) lines.push(`  ● ${c.path} (${c.reason})`);
    }
  } else {
    lines.push('- None');
  }
  lines.push('', '● Next', '');
  if (response.relevantFiles.some((item) => (item.item.tokenEstimate ?? 0) > 4000)) {
    lines.push(
      `  use budgeted source ranges: kgraph pack "${response.query}" --budget 4000`,
    );
  } else {
    lines.push(`  read the ranked source, edit, verify, conclude only if durable knowledge changed`);
  }
  return lines.join('\n');
}

function formatGroupedRelationships(
  relationships: ContextResponse['relationships'],
  explanations?: ContextResponse['relationshipExplanations'],
): string[] {
  const reasonsByRelationship = new Map(
    (explanations ?? []).map((item) => [
      relationshipKey(item.relationship),
      item.reasons,
    ]),
  );
  const imports = relationships.filter((r) => r.relationshipType === 'import');
  const calls = relationships.filter((r) => r.relationshipType === 'calls');
  const contains = relationships.filter(
    (r) => r.relationshipType === 'symbol-contains',
  );
  const other = relationships.filter(
    (r) =>
      r.relationshipType !== 'import' &&
      r.relationshipType !== 'calls' &&
      r.relationshipType !== 'symbol-contains' &&
      r.relationshipType !== 'mentions' &&
      r.relationshipType !== 'belongs-to-domain' &&
      r.relationshipType !== 'stale-reference',
  );

  const lines: string[] = [];
  if (imports.length > 0) {
    lines.push('Imports:');
    for (const r of imports.slice(0, 6)) {
      lines.push(
        `  ${r.sourceId} → ${r.targetId}${formatRelationshipReason(r, reasonsByRelationship)}`,
      );
    }
    appendMore(lines, imports.length, 6, 'import edge');
  }
  if (calls.length > 0) {
    lines.push('Calls:');
    for (const r of calls.slice(0, 6)) {
      lines.push(
        `  ${r.sourceId} → ${r.targetId}${formatRelationshipReason(r, reasonsByRelationship)}`,
      );
    }
    appendMore(lines, calls.length, 6, 'call edge');
  }
  if (contains.length > 0) {
    lines.push('Contains:');
    for (const r of contains.slice(0, 6)) {
      lines.push(
        `  ${r.sourceId} contains ${r.targetId}${formatRelationshipReason(r, reasonsByRelationship)}`,
      );
    }
    appendMore(lines, contains.length, 6, 'containment edge');
  }
  if (other.length > 0) {
    lines.push('Other:');
    for (const r of other.slice(0, 6)) {
      lines.push(
        `  ${r.sourceId} ${r.relationshipType} ${r.targetId}${formatRelationshipReason(r, reasonsByRelationship)}`,
      );
    }
    appendMore(lines, other.length, 6, 'graph edge');
  }
  return lines.length > 0 ? lines : ['- None'];
}

function formatList(items: string[]): string[] {
  return items.length > 0 ? items : ['- None'];
}

function limited<T>(items: T[], count: number): T[] {
  return items.slice(0, count);
}

function appendMore(lines: string[], total: number, shown: number, label: string): void {
  const remaining = total - shown;
  if (remaining > 0) {
    lines.push(`  ◌ ${remaining} more ${label}${remaining === 1 ? '' : 's'} omitted from display`);
  }
}

function atomLine(title: string, detail: string): string {
  return `  ● ${title}\n    because ${detail}`;
}

function formatReasons(reasons: string[]): string {
  if (reasons.length === 0) {
    return 'it is near the query';
  }
  const visible = reasons.slice(0, 3);
  const remaining = reasons.length - visible.length;
  return remaining > 0
    ? `${visible.join('; ')}; and ${remaining} more`
    : visible.join('; ');
}

function nearbySymbolItems(response: ContextResponse): Array<{
  symbol: NonNullable<ContextResponse['nearbySymbols']>[number];
  reasons: string[];
}> {
  if (response.nearbySymbolExplanations) {
    return response.nearbySymbolExplanations;
  }
  return (response.nearbySymbols ?? []).map((symbol) => ({
    symbol,
    reasons: ['exported symbol from 1-hop import'],
  }));
}

function relevantGraphRelationships(
  response: ContextResponse,
): ContextResponse['relationships'] {
  const anchorPaths = response.relevantFiles
    .filter(
      (item) =>
        !item.reasons.some((reason) =>
          reason.includes('generic path-only match penalty'),
        ),
    )
    .slice(0, 3)
    .map((item) => item.item.path);

  const paths = anchorPaths.length > 0
    ? anchorPaths
    : response.relevantFiles.slice(0, 1).map((item) => item.item.path);

  if (paths.length === 0) return response.relationships;
  return response.relationships.filter((relationship) =>
    paths.some(
      (path) =>
        relationship.sourceId.includes(path) ||
        relationship.targetId.includes(path),
    ),
  );
}

function contextConfidence(response: ContextResponse): string {
  const confidence = response.relevantCognition
    .map((item) => item.item.confidence)
    .find(Boolean);
  return confidence ?? (response.relevantFiles.length > 0 ? 'medium' : 'low');
}

function contextSources(response: ContextResponse): string[] {
  const sources: string[] = [];
  if (response.relevantCognition.length > 0) sources.push('atom');
  if ((response.gitChanges ?? []).length > 0) sources.push('git change');
  if (response.relevantSymbols.length > 0) sources.push('symbol');
  if (relevantGraphRelationships(response).length > 0) sources.push('graph');
  if (response.relevantFiles.length > 0) sources.push('file');
  return sources;
}

function formatRelationshipReason(
  relationship: ContextResponse['relationships'][number],
  reasonsByRelationship: Map<string, string[]>,
): string {
  const reasons = reasonsByRelationship.get(relationshipKey(relationship));
  return reasons && reasons.length > 0
    ? ` because ${formatReasons(reasons)}`
    : '';
}

function relationshipKey(
  relationship: ContextResponse['relationships'][number],
): string {
  return [
    relationship.sourceId,
    relationship.targetId,
    relationship.relationshipType,
  ].join('\0');
}
