import type { Command } from 'commander';
import { rm } from 'node:fs/promises';
import { loadConfig } from '../../config/config.js';
import { removeIntegrations } from '../../integrations/integration-store.js';
import { pathExists, resolveWorkspace } from '../../storage/kgraph-paths.js';
import type { IntegrationName } from '../../types/config.js';
import { runCommand } from '../errors.js';

interface UninstallOptions {
  yes?: boolean;
  keepIntegrations?: boolean;
}

export function registerUninstallCommand(program: Command): void {
  program
    .command('uninstall')
    .description('Remove KGraph from this repository')
    .option('--yes', 'Apply the uninstall after previewing what will be removed')
    .option(
      '--keep-integrations',
      'Remove only .kgraph/ and preserve generated AI tool instruction files',
    )
    .action((options: UninstallOptions) =>
      runCommand(async () => {
        const workspace = resolveWorkspace(process.cwd());
        const initialized = await pathExists(workspace.kgraphPath);
        const configuredIntegrations = initialized
          ? (await loadConfig(workspace)).integrations.map(
              (integration) => integration.name,
            )
          : [];

        printUninstallPreview({
          initialized,
          integrations: configuredIntegrations,
          keepIntegrations: options.keepIntegrations === true,
          applying: options.yes === true,
        });

        if (!options.yes) {
          return;
        }

        if (
          initialized &&
          !options.keepIntegrations &&
          configuredIntegrations.length > 0
        ) {
          await removeIntegrations(workspace, configuredIntegrations);
        }

        if (initialized) {
          await rm(workspace.kgraphPath, { recursive: true, force: true });
        }

        console.log('');
        console.log('KGraph uninstall complete.');
        console.log('Run `kgraph init` to set up this repository again.');
      }),
    );
}

function printUninstallPreview(input: {
  initialized: boolean;
  integrations: IntegrationName[];
  keepIntegrations: boolean;
  applying: boolean;
}): void {
  console.log('KGraph Uninstall Preview');
  console.log('');
  console.log('Will remove:');
  if (input.initialized) {
    console.log('- .kgraph/ runtime workspace');
  } else {
    console.log('- Nothing: .kgraph/ does not exist in this repository');
  }

  if (!input.keepIntegrations) {
    if (input.integrations.length > 0) {
      console.log(
        `- KGraph-managed integration blocks/files for: ${input.integrations.join(', ')}`,
      );
    } else {
      console.log('- No configured integration blocks/files found');
    }
  }

  console.log('');
  console.log('Will preserve:');
  console.log('- Repository source files');
  console.log('- User-authored content outside KGraph managed blocks');
  if (input.keepIntegrations) {
    console.log('- KGraph-managed integration instruction files');
  }

  if (!input.applying) {
    console.log('');
    console.log('No files were removed. Run `kgraph uninstall --yes` to apply.');
  }
}
