import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadConfig, saveConfig } from "../config/config.js";
import { pathExists } from "../storage/kgraph-paths.js";
import type { IntegrationConfig, IntegrationName, KGraphWorkspace } from "../types/config.js";
import { getIntegrationAdapter } from "./integration-registry.js";
import { removeManagedBlock, upsertManagedBlock } from "./instruction-blocks.js";

export interface IntegrationStatus {
  name: IntegrationName;
  enabled: boolean;
  targetPath: string;
  targetExists: boolean;
}

export async function listIntegrations(workspace: KGraphWorkspace): Promise<IntegrationStatus[]> {
  const config = await loadConfig(workspace);
  const statuses = await Promise.all(
    config.integrations.map(async (integration) => ({
      name: integration.name,
      enabled: integration.enabled,
      targetPath: integration.targetPath,
      targetExists: await pathExists(path.join(workspace.rootPath, integration.targetPath))
    }))
  );
  return statuses.sort((left, right) => left.name.localeCompare(right.name));
}

export async function addIntegrations(workspace: KGraphWorkspace, names: IntegrationName[]): Promise<IntegrationConfig[]> {
  const config = await loadConfig(workspace);
  const byName = new Map(config.integrations.map((integration) => [integration.name, integration]));
  const changed: IntegrationConfig[] = [];

  for (const name of names) {
    const adapter = getIntegrationAdapter(name);
    const next: IntegrationConfig = {
      name: adapter.name,
      enabled: true,
      targetPath: adapter.targetPath
    };
    byName.set(adapter.name, next);
    await writeIntegrationInstructions(workspace.rootPath, adapter.targetPath, adapter.name, adapter.instructions);
    changed.push(next);
  }

  config.integrations = [...byName.values()].sort((left, right) => left.name.localeCompare(right.name));
  await saveConfig(workspace, config);
  return changed;
}

export async function removeIntegrations(workspace: KGraphWorkspace, names: IntegrationName[]): Promise<IntegrationName[]> {
  const config = await loadConfig(workspace);
  const removeNames = new Set(names);
  const removed: IntegrationName[] = [];

  for (const name of removeNames) {
    const adapter = getIntegrationAdapter(name);
    await removeIntegrationInstructions(workspace.rootPath, adapter.targetPath, adapter.name);
    removed.push(adapter.name);
  }

  config.integrations = config.integrations.filter((integration) => !removeNames.has(integration.name));
  await saveConfig(workspace, config);
  return removed.sort((left, right) => left.localeCompare(right));
}

async function writeIntegrationInstructions(rootPath: string, targetPath: string, integrationName: string, instructions: string): Promise<void> {
  const fullPath = path.join(rootPath, targetPath);
  const existing = (await pathExists(fullPath)) ? await readFile(fullPath, "utf8") : "";
  const next = upsertManagedBlock(existing, integrationName, instructions);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, next, "utf8");
}

async function removeIntegrationInstructions(rootPath: string, targetPath: string, integrationName: string): Promise<void> {
  const fullPath = path.join(rootPath, targetPath);
  if (!(await pathExists(fullPath))) {
    return;
  }
  const existing = await readFile(fullPath, "utf8");
  const next = removeManagedBlock(existing, integrationName);
  if (next.trim().length === 0) {
    await rm(fullPath, { force: true });
    return;
  }
  await writeFile(fullPath, next, "utf8");
}
