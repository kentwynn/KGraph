import type { Command } from 'commander';
import { refreshCognitionReferenceStatuses } from '../../cognition/cognition-updater.js';
import { loadConfig } from '../../config/config.js';
import { scanRepository } from '../../scanner/repo-scanner.js';
import { assertWorkspace } from '../../storage/kgraph-paths.js';
import { readMaps, writeMaps } from '../../storage/map-store.js';
import { runCommand } from '../errors.js';

export function registerScanCommand(program: Command): void {
  program
    .command('scan')
    .description('Scan the repository into deterministic KGraph maps')
    .option('--verbose', 'Print scan warnings')
    .action((options: { verbose?: boolean }) =>
      runCommand(async () => {
        const workspace = await assertWorkspace(process.cwd());
        const config = await loadConfig(workspace);
        const previousMaps = await readMaps(workspace);
        const result = await scanRepository(workspace.rootPath, config, {
          files: previousMaps.fileMap.files,
          symbols: previousMaps.symbolMap.symbols,
          dependencies: previousMaps.dependencyMap.dependencies,
          relationships: previousMaps.relationshipMap.relationships,
          warnings: [],
          scannedAtCommit: previousMaps.fileMap.scannedAtCommit,
        });
        await writeMaps(workspace, result);
        await refreshCognitionReferenceStatuses(workspace, {
          files: result.files,
          symbols: result.symbols,
        });
        console.log(
          `Scanned ${result.files.length} files and ${result.symbols.length} symbols.`,
        );
        if (options.verbose && result.warnings.length > 0) {
          for (const warning of result.warnings) {
            console.warn(`Warning: ${warning}`);
          }
        }
      }),
    );
}
