import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig, saveConfig } from '../config/config.js';
import { pathExists } from '../storage/kgraph-paths.js';
import type {
  ExtractorConfig,
  ExtractorName,
  KGraphWorkspace,
} from '../types/config.js';
import { getExtractorAdapter } from './extractor-registry.js';

export interface ExtractorStatus {
  name: ExtractorName;
  enabled: boolean;
  packageName: string;
  packageInstalled: boolean;
}

export async function listExtractors(
  workspace: KGraphWorkspace,
): Promise<ExtractorStatus[]> {
  const config = await loadConfig(workspace);
  const statuses = await Promise.all(
    config.extractors.map(async (extractor) => ({
      name: extractor.name,
      enabled: extractor.enabled,
      packageName: extractor.packageName,
      packageInstalled: await isExtractorInstalled(
        workspace.rootPath,
        extractor.packageName,
      ),
    })),
  );
  return statuses.sort((left, right) => left.name.localeCompare(right.name));
}

export async function addExtractors(
  workspace: KGraphWorkspace,
  names: ExtractorName[],
): Promise<ExtractorConfig[]> {
  const config = await loadConfig(workspace);
  const byName = new Map(
    config.extractors.map((extractor) => [extractor.name, extractor]),
  );
  const changed: ExtractorConfig[] = [];

  for (const name of names) {
    const adapter = getExtractorAdapter(name);
    const next: ExtractorConfig = {
      name: adapter.name,
      enabled: true,
      packageName: adapter.packageName,
    };
    byName.set(adapter.name, next);
    changed.push(next);
  }

  config.extractors = [...byName.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  await saveConfig(workspace, config);
  return changed;
}

export async function removeExtractors(
  workspace: KGraphWorkspace,
  names: ExtractorName[],
): Promise<ExtractorName[]> {
  const config = await loadConfig(workspace);
  const removeNames = new Set(names);
  config.extractors = config.extractors.filter(
    (extractor) => !removeNames.has(extractor.name),
  );
  await saveConfig(workspace, config);
  return [...removeNames].sort((left, right) => left.localeCompare(right));
}

async function isExtractorInstalled(
  rootPath: string,
  packageName: string,
): Promise<boolean> {
  const packageJsonPath = path.join(rootPath, 'package.json');
  if (await pathExists(packageJsonPath)) {
    try {
      const raw = await readFile(packageJsonPath, 'utf8');
      const pkg = JSON.parse(raw) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        optionalDependencies?: Record<string, string>;
      };
      if (
        pkg.dependencies?.[packageName] ||
        pkg.devDependencies?.[packageName] ||
        pkg.optionalDependencies?.[packageName]
      ) {
        return true;
      }
    } catch {
      return false;
    }
  }

  return pathExists(
    path.join(
      rootPath,
      'node_modules',
      ...packageName.split('/'),
      'package.json',
    ),
  );
}
