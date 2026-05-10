import type { Command } from 'commander';
import { repairCognition } from '../../cognition/cognition-quality.js';
import { assertWorkspace } from '../../storage/kgraph-paths.js';
import { mapsExist, readMaps } from '../../storage/map-store.js';
import { KGraphError, runCommand } from '../errors.js';
import { printQualityReport } from './doctor.js';

export function registerRepairCommand(program: Command): void {
  program
    .command('repair')
    .description('Clean noisy stale references from KGraph cognition')
    .option('--dry-run', 'Show proposed cognition cleanup without writing files')
    .action((options: { dryRun?: boolean }) =>
      runCommand(async () => {
        const workspace = await assertWorkspace(process.cwd());
        if (!(await mapsExist(workspace))) {
          throw new KGraphError('KGraph maps are missing. Run `kgraph scan` first.');
        }
        const maps = await readMaps(workspace);
        const report = await repairCognition(
          workspace,
          maps,
          Boolean(options.dryRun),
        );
        console.log(
          options.dryRun
            ? 'KGraph Repair Dry Run'
            : 'KGraph Repair',
        );
        console.log('');
        printQualityReport(report);
        if (report.changes.length === 0) {
          console.log('No noisy cognition references found.');
        } else if (options.dryRun) {
          console.log('');
          console.log('Run `kgraph repair` to apply these changes.');
        }
      }),
    );
}
