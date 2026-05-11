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
        (item) => `- ${item.item.name} (${item.reasons.join(', ')})`,
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
        return `- ${f.path}${meta ? ` [${meta}]` : ''}`;
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
        return `- ${s.name} (${kindInfo}) in ${s.filePath}${lineRange}`;
      }),
    ),
  );
  lines.push('', '## Relevant Cognition', '');
  lines.push(
    ...formatList(
      response.relevantCognition.map(
        (item) => `- ${item.item.title} [${item.item.referencesStatus}]`,
      ),
    ),
  );
  lines.push('', '## Relationships', '');
  lines.push(...formatGroupedRelationships(response.relationships));
  lines.push('', '## Nearby Symbols (1-hop imports)', '');
  lines.push(
    ...formatList(
      (response.nearbySymbols ?? []).map((s) => {
        const kindInfo = [s.kind, s.parentName].filter(Boolean).join(', ');
        const lineRange =
          s.startLine != null && s.endLine != null
            ? `:${s.startLine}-${s.endLine}`
            : '';
        return `- ${s.name} (${kindInfo}) in ${s.filePath}${lineRange}`;
      }),
    ),
  );
  lines.push('', '## Stale References', '');
  lines.push(...formatList(response.staleReferences.map((ref) => `- ${ref}`)));
  return lines.join('\n');
}

function formatGroupedRelationships(
  relationships: ContextResponse['relationships'],
): string[] {
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
    for (const r of imports) lines.push(`  ${r.sourceId} → ${r.targetId}`);
  }
  if (calls.length > 0) {
    lines.push('Calls:');
    for (const r of calls) lines.push(`  ${r.sourceId} → ${r.targetId}`);
  }
  if (contains.length > 0) {
    lines.push('Contains:');
    for (const r of contains)
      lines.push(`  ${r.sourceId} contains ${r.targetId}`);
  }
  if (other.length > 0) {
    lines.push('Other:');
    for (const r of other)
      lines.push(`  ${r.sourceId} ${r.relationshipType} ${r.targetId}`);
  }
  return lines.length > 0 ? lines : ['- None'];
}

function formatList(items: string[]): string[] {
  return items.length > 0 ? items : ['- None'];
}
