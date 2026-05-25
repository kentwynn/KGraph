import type { Command } from 'commander';
import {
  loadConfig,
  saveConfig,
  writeDefaultConfig,
} from '../../config/config.js';
import { normalizeIntegrationNames } from '../../integrations/integration-registry.js';
import { addIntegrations } from '../../integrations/integration-store.js';
import { ensureKnowledgeStore } from '../../knowledge/atom-store.js';
import { scanRepository } from '../../scanner/repo-scanner.js';
import { ensureWorkspace } from '../../storage/kgraph-paths.js';
import { readMaps, writeMaps } from '../../storage/map-store.js';
import type { IntegrationMode } from '../../types/config.js';
import { KGraphError, runCommand } from '../errors.js';
import {
  promptForInitIntegrations,
  promptScopeConfirmation,
  promptWorkspaceSetup,
  shouldPromptForInitIntegrations,
} from '../init-prompt.js';
import {
  detectMachineIntegrationRecommendations,
  recommendedIntegrationsForInit,
} from '../init-recommendations.js';
import { renderInitSummary } from '../init-summary.js';
import { countScopeFiles, detectWorkspaces } from '../workspace-detection.js';

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
        await ensureKnowledgeStore(workspace);
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

        // Workspace detection — only for fresh init, non-destructive
        const workspaceInfo = await detectWorkspaces(workspace.rootPath);
        if (workspaceInfo && Object.keys(config.domainHints).length === 0) {
          const result = await promptWorkspaceSetup(workspaceInfo);
          if (result.applyDomains && result.domainHints) {
            config = { ...config, domainHints: result.domainHints };
            await saveConfig(workspace, config);
          }
        }

        // Pre-scan scope check — fast file count before heavy scan
        const fileCount = await countScopeFiles(workspace.rootPath, config);
        const scopeResult = await promptScopeConfirmation(fileCount);
        if (!scopeResult.proceed) {
          console.log(
            'Init cancelled. Edit .kgraph/config.yaml to adjust scope, then run `kgraph init` again.',
          );
          return;
        }
        if (scopeResult.narrowedInclude) {
          config = { ...config, include: scopeResult.narrowedInclude };
          await saveConfig(workspace, config);
        }

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
        console.log(
          `Scanned ${result.files.length} files and ${result.symbols.length} symbols.`,
        );

        const detectedMachineIntegrations =
          await detectMachineIntegrationRecommendations();
        let recommendedIntegrations = recommendedIntegrationsForInit({
          configuredIntegrations: config.integrations,
          detectedIntegrations: detectedMachineIntegrations,
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

        console.log('');
        console.log(
          renderInitSummary({
            files: result.files,
            integrations: config.integrations,
            recommendedIntegrations,
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
