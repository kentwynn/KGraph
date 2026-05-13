import type { Command } from 'commander';
import { compactCognition } from '../../cognition/compact.js';
import { assertWorkspace } from '../../storage/kgraph-paths.js';
import { runCommand } from '../errors.js';

interface CompactOptions {
  dryRun?: boolean;
  json?: boolean;
}

export function registerCompactCommand(program: Command): void {
  program
    .command('compact')
    .description('Merge duplicate cognition and archive low-value stale entries')
    .option('--dry-run', 'Preview compaction without changing files')
    .option('--json', 'Print JSON output')
    .action((options: CompactOptions) =>
      runCommand(async () => {
        const workspace = await assertWorkspace(process.cwd());
        const result = await compactCognition(workspace, Boolean(options.dryRun));
        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }
        console.log(options.dryRun ? 'KGraph Compact Preview' : 'KGraph Compact Complete');
        console.log(`Merged duplicate groups: ${result.merged.length}`);
        console.log(`Archived stale low-confidence notes: ${result.archived.length}`);
        for (const item of result.merged) {
          console.log(`- merged ${item.sourceIds.length} notes into ${item.title}`);
        }
        for (const item of result.archived) {
          console.log(`- archived ${item.title}: ${item.reason}`);
        }
      }),
    );
}
