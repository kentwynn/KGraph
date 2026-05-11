import type { Command } from 'commander';
import { loadConfig, writeDefaultConfig } from '../../config/config.js';
import { normalizeIntegrationNames } from '../../integrations/integration-registry.js';
import { addIntegrations } from '../../integrations/integration-store.js';
import { scanRepository } from '../../scanner/repo-scanner.js';
import { ensureWorkspace } from '../../storage/kgraph-paths.js';
import { readMaps, writeMaps } from '../../storage/map-store.js';
import type { IntegrationMode } from '../../types/config.js';
import { KGraphError, runCommand } from '../errors.js';

interface InitOptions {
  integration?: string[];
  integrations?: string;
  mode: string;
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a .kgraph workspace')
    .option(
      '--integration <name>',
      'Configure an AI tool integration',
      collectOption,
      [],
    )
    .option(
      '--integrations <names>',
      'Configure comma-separated AI tool integrations',
    )
    .option(
      '--mode <mode>',
      'Integration mode: smart, always, manual, or off',
      'smart',
    )
    .action((options: InitOptions) =>
      runCommand(async () => {
        const workspace = await ensureWorkspace(process.cwd());
        const wroteConfig = await writeDefaultConfig(workspace);
        console.log(
          wroteConfig
            ? 'Initialized .kgraph workspace.'
            : '.kgraph workspace already initialized.',
        );

        const names = normalizeIntegrationNames([
          ...(options.integration ?? []),
          ...(options.integrations ? [options.integrations] : []),
        ]);
        if (names.length > 0) {
          const mode = normalizeIntegrationMode(options.mode);
          const changed = await addIntegrations(workspace, names, mode);
          console.log(
            `Configured integrations: ${changed.map((item) => `${item.name}:${item.mode}`).join(', ')}`,
          );
        }

        const config = await loadConfig(workspace);
        const previousMaps = await readMaps(workspace);
        const result = await scanRepository(workspace.rootPath, config, {
          files: previousMaps.fileMap.files,
          symbols: previousMaps.symbolMap.symbols,
          dependencies: previousMaps.dependencyMap.dependencies,
          relationships: previousMaps.relationshipMap.relationships,
          warnings: [],
        });
        await writeMaps(workspace, result);
        console.log(
          `Scanned ${result.files.length} files and ${result.symbols.length} symbols.`,
        );
      }),
    );
}

function collectOption(value: string, previous: string[]): string[] {
  previous.push(value);
  return previous;
}

function normalizeIntegrationMode(value: string): IntegrationMode {
  if (
    value === 'smart' ||
    value === 'always' ||
    value === 'manual' ||
    value === 'off'
  ) {
    return value;
  }
  throw new KGraphError('--mode must be smart, always, manual, or off.');
}
