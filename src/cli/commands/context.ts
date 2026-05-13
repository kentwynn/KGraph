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
  const lines = [`# KGraph Context`, ``, `Query: ${response.query}`, ``];
  lines.push('## Matched Domains', '');
  lines.push(
    ...formatList(
      response.matchedDomains.map(
        (item) => `- ${item.item.name} because ${formatReasons(item.reasons)}`,
      ),
    ),
  );
  lines.push('', '## Relevant Files', '');
  lines.push(
    ...formatList(
      response.relevantFiles.map((item) => {
        const f = item.item;
        const meta = [
          f.language,
          f.tokenEstimate ? `~${f.tokenEstimate} tokens` : '',
        ]
          .filter(Boolean)
          .join(', ');
        return `- ${f.path}${meta ? ` [${meta}]` : ''} because ${formatReasons(item.reasons)}`;
      }),
    ),
  );
  lines.push('', '## Relevant Symbols', '');
  lines.push(
    ...formatList(
      response.relevantSymbols.map((item) => {
        const s = item.item;
        const kindInfo = [s.kind, s.parentName].filter(Boolean).join(', ');
        const lineRange =
          s.startLine != null && s.endLine != null
            ? `:${s.startLine}-${s.endLine}`
            : '';
        return `- ${s.name} (${kindInfo}) in ${s.filePath}${lineRange} because ${formatReasons(item.reasons)}`;
      }),
    ),
  );
  lines.push('', '## Relevant Cognition', '');
  lines.push(
    ...formatList(
      response.relevantCognition.map(
        (item) =>
          `- ${item.item.title} [${item.item.kind ?? 'summary'}, ${item.item.confidence ?? 'medium'}, ${item.item.referencesStatus}] because ${formatReasons(item.reasons)}`,
      ),
    ),
  );
  lines.push('', '## Relationships', '');
  lines.push(
    ...formatGroupedRelationships(
      response.relationships,
      response.relationshipExplanations,
    ),
  );
  lines.push('', '## Nearby Symbols (1-hop imports)', '');
  lines.push(
    ...formatList(
      nearbySymbolItems(response).map(({ symbol: s, reasons }) => {
        const kindInfo = [s.kind, s.parentName].filter(Boolean).join(', ');
        const lineRange =
          s.startLine != null && s.endLine != null
            ? `:${s.startLine}-${s.endLine}`
            : '';
        return `- ${s.name} (${kindInfo}) in ${s.filePath}${lineRange} because ${formatReasons(reasons)}`;
      }),
    ),
  );
  lines.push('', '## Stale References', '');
  lines.push(...formatList(response.staleReferences.map((ref) => `- ${ref}`)));
  lines.push('', '## Recent Git Changes', '');
  if (response.gitChanges && response.gitChanges.length > 0) {
    const staged = response.gitChanges.filter((c) => c.status === 'staged');
    const unstaged = response.gitChanges.filter((c) => c.status === 'unstaged');
    const recent = response.gitChanges.filter(
      (c) => c.status === 'recent-commit',
    );
    if (staged.length > 0) {
      lines.push('Staged:');
      for (const c of staged) lines.push(`  ${c.path} (${c.reason})`);
    }
    if (unstaged.length > 0) {
      lines.push('Unstaged:');
      for (const c of unstaged) lines.push(`  ${c.path} (${c.reason})`);
    }
    if (recent.length > 0) {
      lines.push('Recent commits:');
      for (const c of recent) lines.push(`  ${c.path} (${c.reason})`);
    }
  } else {
    lines.push('- None');
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
    for (const r of imports) {
      lines.push(
        `  ${r.sourceId} → ${r.targetId}${formatRelationshipReason(r, reasonsByRelationship)}`,
      );
    }
  }
  if (calls.length > 0) {
    lines.push('Calls:');
    for (const r of calls) {
      lines.push(
        `  ${r.sourceId} → ${r.targetId}${formatRelationshipReason(r, reasonsByRelationship)}`,
      );
    }
  }
  if (contains.length > 0) {
    lines.push('Contains:');
    for (const r of contains) {
      lines.push(
        `  ${r.sourceId} contains ${r.targetId}${formatRelationshipReason(r, reasonsByRelationship)}`,
      );
    }
  }
  if (other.length > 0) {
    lines.push('Other:');
    for (const r of other) {
      lines.push(
        `  ${r.sourceId} ${r.relationshipType} ${r.targetId}${formatRelationshipReason(r, reasonsByRelationship)}`,
      );
    }
  }
  return lines.length > 0 ? lines : ['- None'];
}

function formatList(items: string[]): string[] {
  return items.length > 0 ? items : ['- None'];
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
