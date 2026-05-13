import type { Command } from 'commander';
import { refreshKnowledgeAtomStatuses } from '../../knowledge/atom-store.js';
import { readMaps } from '../../storage/map-store.js';
import { assertWorkspace } from '../../storage/kgraph-paths.js';
import { runCommand } from '../errors.js';

export function registerStaleCommand(program: Command): void {
  program
    .command('stale')
    .description('Show knowledge atoms invalidated by changed or missing refs')
    .option('--json', 'Print JSON output')
    .action((options: { json?: boolean }) =>
      runCommand(async () => {
        const workspace = await assertWorkspace(process.cwd());
        const maps = await readMaps(workspace);
        const result = await refreshKnowledgeAtomStatuses(workspace, {
          fileMap: maps.fileMap,
          symbolMap: maps.symbolMap,
        });
        const atoms = result.atoms.filter(
          (atom) => atom.status === 'stale' || atom.status === 'needs-review',
        );
        if (options.json) {
          console.log(JSON.stringify({ updated: result.updated, atoms }, null, 2));
          return;
        }
        console.log('KGraph Stale Knowledge');
        console.log('');
        for (const atom of atoms) {
          console.log(
            `- ${atom.id} [${atom.type}, ${atom.confidence}, ${atom.status}] ${atom.topic}`,
          );
          for (const reason of atom.lifecycle.invalidatedBy ?? []) {
            console.log(`  - ${reason}`);
          }
        }
        if (atoms.length === 0) console.log('- None');
      }),
    );
}
