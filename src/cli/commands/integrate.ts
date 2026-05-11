import type { Command } from 'commander';
import { normalizeIntegrationNames } from '../../integrations/integration-registry.js';
import {
  addIntegrations,
  listIntegrations,
  removeIntegrations,
  setIntegrationMode,
} from '../../integrations/integration-store.js';
import { assertWorkspace } from '../../storage/kgraph-paths.js';
import type { IntegrationMode } from '../../types/config.js';
import { KGraphError, runCommand } from '../errors.js';

export function registerIntegrateCommand(program: Command): void {
  const integrate = program
    .command('integrate')
    .description('Manage AI tool integrations');

  integrate
    .command('list')
    .description('List configured integrations')
    .action(() =>
      runCommand(async () => {
        const workspace = await assertWorkspace(process.cwd());
        const integrations = await listIntegrations(workspace);
        if (integrations.length === 0) {
          console.log('No integrations configured.');
          return;
        }
        for (const integration of integrations) {
          console.log(
            `${integration.name} ${integration.enabled ? 'enabled' : 'disabled'} ${integration.mode} ${integration.targetPath} ${integration.targetExists ? 'present' : 'missing'}`,
          );
        }
      }),
    );

  integrate
    .command('add')
    .description('Add AI tool integrations')
    .argument('<names...>')
    .option('--mode <mode>', 'smart, always, manual, or off', 'smart')
    .action((names: string[], options: { mode: string }) =>
      runCommand(async () => {
        const workspace = await assertWorkspace(process.cwd());
        const normalized = normalizeIntegrationNames(names);
        if (normalized.length === 0) {
          throw new KGraphError('Provide at least one integration name.');
        }
        const mode = normalizeIntegrationMode(options.mode);
        const changed = await addIntegrations(workspace, normalized, mode);
        console.log(
          `Configured integrations: ${changed.map((item) => `${item.name}:${item.mode}`).join(', ')}`,
        );
      }),
    );

  integrate
    .command('set')
    .description('Set AI tool integration mode')
    .argument('<names...>')
    .requiredOption('--mode <mode>', 'smart, always, manual, or off')
    .action((names: string[], options: { mode: string }) =>
      runCommand(async () => {
        const workspace = await assertWorkspace(process.cwd());
        const normalized = normalizeIntegrationNames(names);
        if (normalized.length === 0) {
          throw new KGraphError('Provide at least one integration name.');
        }
        const mode = normalizeIntegrationMode(options.mode);
        const changed = await setIntegrationMode(workspace, normalized, mode);
        console.log(
          `Updated integrations: ${changed.map((item) => `${item.name}:${item.mode}`).join(', ')}`,
        );
      }),
    );

  integrate
    .command('remove')
    .description('Remove AI tool integrations')
    .argument('<names...>')
    .action((names: string[]) =>
      runCommand(async () => {
        const workspace = await assertWorkspace(process.cwd());
        const normalized = normalizeIntegrationNames(names);
        if (normalized.length === 0) {
          throw new KGraphError('Provide at least one integration name.');
        }
        const removed = await removeIntegrations(workspace, normalized);
        console.log(`Removed integrations: ${removed.join(', ')}`);
      }),
    );
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
