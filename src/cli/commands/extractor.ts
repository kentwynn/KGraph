import type { Command } from 'commander';
import {
  installCommandForExtractors,
  normalizeExtractorNames,
} from '../../extractors/extractor-registry.js';
import {
  addExtractors,
  listExtractors,
  removeExtractors,
} from '../../extractors/extractor-store.js';
import { assertWorkspace } from '../../storage/kgraph-paths.js';
import { KGraphError, runCommand } from '../errors.js';

export function registerExtractorCommand(program: Command): void {
  const extractor = program
    .command('extractor')
    .description('Manage optional deep language extractors');

  extractor
    .command('list')
    .description('List configured optional extractors')
    .action(() =>
      runCommand(async () => {
        const workspace = await assertWorkspace(process.cwd());
        const extractors = await listExtractors(workspace);
        if (extractors.length === 0) {
          console.log('No extractors configured.');
          return;
        }
        for (const item of extractors) {
          console.log(
            `${item.name} ${item.enabled ? 'enabled' : 'disabled'} ${item.packageName} ${item.packageInstalled ? 'present' : 'missing'}`,
          );
        }
      }),
    );

  extractor
    .command('add')
    .description('Configure optional deep extractors')
    .argument('<names...>')
    .action((names: string[]) =>
      runCommand(async () => {
        const workspace = await assertWorkspace(process.cwd());
        const normalized = normalizeExtractorNames(names);
        if (normalized.length === 0) {
          throw new KGraphError('Provide at least one extractor name.');
        }
        const changed = await addExtractors(workspace, normalized);
        console.log(
          `Configured extractors: ${changed.map((item) => item.name).join(', ')}`,
        );
        console.log(
          `Install packages: ${installCommandForExtractors(changed.map((item) => item.packageName))}`,
        );
      }),
    );

  extractor
    .command('remove')
    .description('Remove optional deep extractors')
    .argument('<names...>')
    .action((names: string[]) =>
      runCommand(async () => {
        const workspace = await assertWorkspace(process.cwd());
        const normalized = normalizeExtractorNames(names);
        if (normalized.length === 0) {
          throw new KGraphError('Provide at least one extractor name.');
        }
        const removed = await removeExtractors(workspace, normalized);
        console.log(`Removed extractors: ${removed.join(', ')}`);
      }),
    );
}
