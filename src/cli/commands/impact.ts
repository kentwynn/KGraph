import type { Command } from 'commander';
import { loadConfig } from '../../config/config.js';
import { analyzeImpact, type ImpactResponse } from '../../context/impact.js';
import {
  atomToCognitionNote,
  refreshKnowledgeAtomStatuses,
} from '../../knowledge/atom-store.js';
import { assertWorkspace } from '../../storage/kgraph-paths.js';
import { mapsExist, readMaps } from '../../storage/map-store.js';
import { KGraphError, runCommand } from '../errors.js';

export function registerImpactCommand(program: Command): void {
  program
    .command('impact <query>')
    .description('Show practical impact for a file, symbol, or topic')
    .option('--json', 'Print JSON output')
    .action((query: string, options: { json?: boolean }) =>
      runCommand(async () => {
        if (!query.trim()) {
          throw new KGraphError('Query cannot be empty.');
        }
        const workspace = await assertWorkspace(process.cwd());
        if (!(await mapsExist(workspace))) {
          throw new KGraphError('KGraph maps are missing. Run `kgraph scan` first.');
        }
        const [config, maps] = await Promise.all([
          loadConfig(workspace),
          readMaps(workspace),
        ]);
        const { atoms } = await refreshKnowledgeAtomStatuses(workspace, {
          fileMap: maps.fileMap,
          symbolMap: maps.symbolMap,
        });
        const cognition = atoms
          .filter((atom) => atom.status !== 'archived')
          .map(atomToCognitionNote);
        const response = analyzeImpact(query, maps, cognition, config.maxContextItems);
        console.log(options.json ? JSON.stringify(response, null, 2) : renderImpactMarkdown(response));
      }),
    );
}

export function renderImpactMarkdown(response: ImpactResponse): string {
  const lines = [`# KGraph Impact`, ``, `Query: ${response.query}`, ``];
  lines.push('## Matched Files', '');
  lines.push(...formatList(response.files.map((file) => `- ${file.item.path} (${file.reasons.join(', ')})`)));
  lines.push('', '## Matched Symbols', '');
  lines.push(...formatList(response.symbols.map((symbol) => `- ${symbol.item.name} in ${symbol.item.filePath}`)));
  lines.push('', '## Imported By', '');
  lines.push(...formatList(response.importedBy.map((file) => `- ${file}`)));
  lines.push('', '## Called By', '');
  lines.push(...formatList(response.callers.map((rel) => `- ${rel.sourceId} calls ${rel.targetId} (${rel.confidence})`)));
  lines.push('', '## Calls', '');
  lines.push(...formatList(response.calls.map((rel) => `- ${rel.sourceId} calls ${rel.targetId} (${rel.confidence})`)));
  lines.push('', '## Ownership', '');
  lines.push(...formatList(response.ownership.map((rel) => `- ${rel.sourceId} owns ${rel.targetId} (${rel.confidence})`)));
  lines.push('', '## Related Knowledge', '');
  lines.push(...formatList(response.relatedCognition.map((note) => `- ${note.title} [${note.referencesStatus}, ${note.confidence}]`)));
  lines.push('', '## Risk', '');
  lines.push(...formatList(response.risk.map((item) => `- ${item}`)));
  return lines.join('\n');
}

function formatList(items: string[]): string[] {
  return items.length > 0 ? items : ['- None'];
}
