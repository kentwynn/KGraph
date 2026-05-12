import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { KGraphError } from '../cli/errors.js';
import { getCurrentCommit } from '../scanner/git-utils.js';
import type { KGraphWorkspace } from '../types/config.js';
import type {
  DependencyMap,
  FileMap,
  RelationshipMap,
  ScanResult,
  SymbolMap,
} from '../types/maps.js';
import { pathExists } from './kgraph-paths.js';

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  if (!(await pathExists(filePath))) {
    return fallback;
  }

  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new KGraphError(`Unable to read JSON map ${filePath}: ${message}`);
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function mapPaths(workspace: KGraphWorkspace): Record<string, string> {
  return {
    files: path.join(workspace.mapPath, 'files.json'),
    symbols: path.join(workspace.mapPath, 'symbols.json'),
    dependencies: path.join(workspace.mapPath, 'dependencies.json'),
    relationships: path.join(workspace.mapPath, 'relationships.json'),
  };
}

export async function readMaps(workspace: KGraphWorkspace): Promise<{
  fileMap: FileMap;
  symbolMap: SymbolMap;
  dependencyMap: DependencyMap;
  relationshipMap: RelationshipMap;
}> {
  const paths = mapPaths(workspace);
  return {
    fileMap: await readJson<FileMap>(paths.files, {
      generatedAt: '',
      files: [],
    }),
    symbolMap: await readJson<SymbolMap>(paths.symbols, {
      generatedAt: '',
      symbols: [],
    }),
    dependencyMap: await readJson<DependencyMap>(paths.dependencies, {
      generatedAt: '',
      dependencies: [],
    }),
    relationshipMap: await readJson<RelationshipMap>(paths.relationships, {
      generatedAt: '',
      relationships: [],
    }),
  };
}

export async function writeMaps(
  workspace: KGraphWorkspace,
  result: ScanResult,
): Promise<void> {
  const generatedAt = new Date().toISOString();
  const scannedAtCommit =
    (await getCurrentCommit(workspace.rootPath)) ?? undefined;
  const paths = mapPaths(workspace);
  await writeJson(paths.files, {
    generatedAt,
    scannedAtCommit,
    files: result.files,
  } satisfies FileMap);
  await writeJson(paths.symbols, {
    generatedAt,
    symbols: result.symbols,
  } satisfies SymbolMap);
  await writeJson(paths.dependencies, {
    generatedAt,
    dependencies: result.dependencies,
  } satisfies DependencyMap);
  await writeJson(paths.relationships, {
    generatedAt,
    relationships: result.relationships,
  } satisfies RelationshipMap);
}

export async function mapsExist(workspace: KGraphWorkspace): Promise<boolean> {
  const paths = mapPaths(workspace);
  return (
    (await pathExists(paths.files)) &&
    (await pathExists(paths.symbols)) &&
    (await pathExists(paths.dependencies)) &&
    (await pathExists(paths.relationships))
  );
}
