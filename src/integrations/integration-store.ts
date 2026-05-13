import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig, saveConfig } from '../config/config.js';
import { pathExists } from '../storage/kgraph-paths.js';
import type {
  IntegrationConfig,
  IntegrationMode,
  IntegrationName,
  KGraphWorkspace,
} from '../types/config.js';
import {
  applyContextPolicy,
  removeManagedBlock,
  upsertManagedBlock,
} from './instruction-blocks.js';
import { getIntegrationAdapter } from './integration-registry.js';

export interface IntegrationStatus {
  name: IntegrationName;
  enabled: boolean;
  mode: IntegrationMode;
  targetPath: string;
  targetExists: boolean;
}

export async function listIntegrations(
  workspace: KGraphWorkspace,
): Promise<IntegrationStatus[]> {
  const config = await loadConfig(workspace);
  const statuses = await Promise.all(
    config.integrations.map(async (integration) => ({
      name: integration.name,
      enabled: integration.enabled,
      mode: integration.mode,
      targetPath: integration.targetPath,
      targetExists: await pathExists(
        path.join(workspace.rootPath, integration.targetPath),
      ),
    })),
  );
  return statuses.sort((left, right) => left.name.localeCompare(right.name));
}

export async function addIntegrations(
  workspace: KGraphWorkspace,
  names: IntegrationName[],
  mode: IntegrationMode = 'always',
): Promise<IntegrationConfig[]> {
  const config = await loadConfig(workspace);
  const byName = new Map(
    config.integrations.map((integration) => [integration.name, integration]),
  );
  const changed: IntegrationConfig[] = [];

  for (const name of names) {
    const adapter = getIntegrationAdapter(name);
    const next: IntegrationConfig = {
      name: adapter.name,
      enabled: mode !== 'off',
      mode,
      targetPath: adapter.targetPath,
    };
    byName.set(adapter.name, next);
    if (mode === 'off') {
      await removeIntegrationInstructions(
        workspace.rootPath,
        adapter.targetPath,
        adapter.name,
      );
      await removeIntegrationCommandFiles(
        workspace.rootPath,
        adapter.commandFiles ?? [],
      );
    } else {
      await writeIntegrationInstructions(
        workspace.rootPath,
        adapter.targetPath,
        adapter.name,
        applyContextPolicy(adapter.instructions, mode),
      );
      await writeIntegrationCommandFiles(
        workspace.rootPath,
        (adapter.commandFiles ?? []).map((file) => ({
          ...file,
          content: applyContextPolicy(file.content, mode),
        })),
      );
    }
    await removeIntegrationCommandFiles(
      workspace.rootPath,
      adapter.obsoleteCommandFiles ?? [],
    );
    changed.push(next);
  }

  config.integrations = [...byName.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );

  await saveConfig(workspace, config);
  return changed;
}

export async function setIntegrationMode(
  workspace: KGraphWorkspace,
  names: IntegrationName[],
  mode: IntegrationMode,
): Promise<IntegrationConfig[]> {
  return addIntegrations(workspace, names, mode);
}

export async function removeIntegrations(
  workspace: KGraphWorkspace,
  names: IntegrationName[],
): Promise<IntegrationName[]> {
  const config = await loadConfig(workspace);
  const removeNames = new Set(names);
  const removed: IntegrationName[] = [];

  for (const name of removeNames) {
    const adapter = getIntegrationAdapter(name);
    await removeIntegrationInstructions(
      workspace.rootPath,
      adapter.targetPath,
      adapter.name,
    );
    await removeIntegrationCommandFiles(
      workspace.rootPath,
      adapter.commandFiles ?? [],
    );
    await removeIntegrationCommandFiles(
      workspace.rootPath,
      adapter.obsoleteCommandFiles ?? [],
    );
    removed.push(adapter.name);
  }

  config.integrations = config.integrations.filter(
    (integration) => !removeNames.has(integration.name),
  );

  await saveConfig(workspace, config);
  return removed.sort((left, right) => left.localeCompare(right));
}

async function writeIntegrationInstructions(
  rootPath: string,
  targetPath: string,
  integrationName: string,
  instructions: string,
): Promise<void> {
  const fullPath = path.join(rootPath, targetPath);
  const existing = (await pathExists(fullPath))
    ? await readFile(fullPath, 'utf8')
    : '';
  const next = upsertManagedBlock(existing, integrationName, instructions);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, next, 'utf8');
}

async function removeIntegrationInstructions(
  rootPath: string,
  targetPath: string,
  integrationName: string,
): Promise<void> {
  const fullPath = path.join(rootPath, targetPath);
  if (!(await pathExists(fullPath))) {
    return;
  }
  const existing = await readFile(fullPath, 'utf8');
  const next = removeManagedBlock(existing, integrationName);
  if (next.trim().length === 0) {
    await rm(fullPath, { force: true });
    return;
  }
  await writeFile(fullPath, next, 'utf8');
}

async function writeIntegrationCommandFiles(
  rootPath: string,
  files: { path: string; content: string }[],
): Promise<void> {
  for (const file of files) {
    const fullPath = path.join(rootPath, file.path);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, file.content.trimEnd() + '\n', 'utf8');
  }
}

async function removeIntegrationCommandFiles(
  rootPath: string,
  files: ({ path: string } | string)[],
): Promise<void> {
  for (const file of files) {
    const filePath = typeof file === 'string' ? file : file.path;
    await rm(path.join(rootPath, filePath), { force: true, recursive: true });
  }
}
