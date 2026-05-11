import type { Command } from 'commander';
import { loadConfig, writeDefaultConfig } from '../../config/config.js';
import { installCommandForExtractors } from '../../extractors/extractor-registry.js';
import { addExtractors } from '../../extractors/extractor-store.js';
import { normalizeIntegrationNames } from '../../integrations/integration-registry.js';
import { addIntegrations } from '../../integrations/integration-store.js';
import { scanRepository } from '../../scanner/repo-scanner.js';
import { ensureWorkspace } from '../../storage/kgraph-paths.js';
import { readMaps, writeMaps } from '../../storage/map-store.js';
import type { IntegrationMode } from '../../types/config.js';
import { KGraphError, runCommand } from '../errors.js';
import {
  promptForInitExtractors,
  promptForInitIntegrations,
  shouldPromptForInitExtractors,
  shouldPromptForInitIntegrations,
} from '../init-prompt.js';
import {
  detectMachineIntegrationRecommendations,
  recommendedExtractorsForInit,
  recommendedIntegrationsForInit,
} from '../init-recommendations.js';
import { renderInitSummary } from '../init-summary.js';

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
      'Integration mode: always, smart, manual, or off',
      'always',
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

        let config = await loadConfig(workspace);
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

        const detectedMachineIntegrations =
          await detectMachineIntegrationRecommendations();
        let recommendedIntegrations = recommendedIntegrationsForInit({
          configuredIntegrations: config.integrations,
          detectedIntegrations: detectedMachineIntegrations,
        });
        let recommendedExtractors = recommendedExtractorsForInit({
          files: result.files,
          configuredExtractors: config.extractors,
        });

        if (
          shouldPromptForInitIntegrations({
            explicitIntegrationsRequested: names.length > 0,
            configuredIntegrations: config.integrations,
          })
        ) {
          const selected = await promptForInitIntegrations(
            recommendedIntegrations,
          );
          if (selected.length > 0) {
            const changed = await addIntegrations(
              workspace,
              selected,
              'always',
            );
            console.log(
              `Configured integrations: ${changed.map((item) => `${item.name}:${item.mode}`).join(', ')}`,
            );
            config = await loadConfig(workspace);
            recommendedIntegrations = recommendedIntegrationsForInit({
              configuredIntegrations: config.integrations,
              detectedIntegrations: detectedMachineIntegrations,
            });
          }
        }

        if (
          shouldPromptForInitExtractors({
            configuredExtractors: config.extractors,
          })
        ) {
          const selected = await promptForInitExtractors(recommendedExtractors);
          if (selected.length > 0) {
            const changed = await addExtractors(workspace, selected);
            console.log(
              `Configured extractors: ${changed.map((item) => item.name).join(', ')}`,
            );
            console.log(
              `Install packages: ${installCommandForExtractors(changed.map((item) => item.packageName))}`,
            );
            config = await loadConfig(workspace);
            recommendedExtractors = recommendedExtractorsForInit({
              files: result.files,
              configuredExtractors: config.extractors,
            });
          }
        }

        console.log('');
        console.log(
          renderInitSummary({
            files: result.files,
            integrations: config.integrations,
            recommendedIntegrations,
            extractors: config.extractors,
            recommendedExtractors,
          }),
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
