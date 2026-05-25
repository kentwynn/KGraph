import fg from 'fast-glob';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  buildFastGlobIgnore,
  readGitignorePatterns,
} from '../scanner/file-classifier.js';
import { pathExists } from '../storage/kgraph-paths.js';
import type { DomainHint, KGraphConfig } from '../types/config.js';

export interface WorkspaceInfo {
  tool: string;
  packages: WorkspacePackage[];
}

export interface WorkspacePackage {
  name: string;
  path: string;
}

/**
 * Detect monorepo workspace tools and their packages.
 * Returns null for simple single-package projects.
 */
export async function detectWorkspaces(
  rootPath: string,
): Promise<WorkspaceInfo | null> {
  // pnpm
  const pnpmPath = path.join(rootPath, 'pnpm-workspace.yaml');
  if (await pathExists(pnpmPath)) {
    const packages = await resolvePnpmPackages(rootPath, pnpmPath);
    if (packages.length > 1) return { tool: 'pnpm', packages };
  }

  // nx
  const nxPath = path.join(rootPath, 'nx.json');
  if (await pathExists(nxPath)) {
    const packages = await resolveNxPackages(rootPath);
    if (packages.length > 1) return { tool: 'nx', packages };
  }

  // lerna
  const lernaPath = path.join(rootPath, 'lerna.json');
  if (await pathExists(lernaPath)) {
    const packages = await resolveLernaPackages(rootPath, lernaPath);
    if (packages.length > 1) return { tool: 'lerna', packages };
  }

  // rush
  const rushPath = path.join(rootPath, 'rush.json');
  if (await pathExists(rushPath)) {
    const packages = await resolveRushPackages(rootPath, rushPath);
    if (packages.length > 1) return { tool: 'rush', packages };
  }

  // npm/yarn workspaces (package.json)
  const pkgPath = path.join(rootPath, 'package.json');
  if (await pathExists(pkgPath)) {
    const packages = await resolveNpmWorkspaces(rootPath, pkgPath);
    if (packages.length > 1) return { tool: 'npm', packages };
  }

  return null;
}

/**
 * Convert detected workspace packages into domainHints.
 */
export function workspacesToDomainHints(
  info: WorkspaceInfo,
): Record<string, DomainHint> {
  const hints: Record<string, DomainHint> = {};
  for (const pkg of info.packages) {
    hints[pkg.name] = { paths: [pkg.path + '/**'] };
  }
  return hints;
}

/**
 * Quick file count using fast-glob (no content read).
 * Used to warn about large scopes before a full scan.
 */
export async function countScopeFiles(
  rootPath: string,
  config: KGraphConfig,
): Promise<number> {
  const gitignorePatterns = await readGitignorePatterns(rootPath);
  const allExcludes = [...config.exclude, ...gitignorePatterns];
  const entries = await fg(config.include, {
    cwd: rootPath,
    dot: true,
    onlyFiles: true,
    unique: true,
    ignore: buildFastGlobIgnore(allExcludes),
    stats: false,
  });
  return entries.length;
}

// --- Resolvers ---

async function resolvePnpmPackages(
  rootPath: string,
  filePath: string,
): Promise<WorkspacePackage[]> {
  try {
    const content = await readFile(filePath, 'utf8');
    // Simple YAML parsing for packages: array
    const lines = content.split(/\r?\n/);
    const globs: string[] = [];
    let inPackages = false;
    for (const line of lines) {
      if (/^packages:/i.test(line.trim())) {
        inPackages = true;
        continue;
      }
      if (inPackages) {
        const match = line.match(/^\s+-\s+['"]?([^'"]+)['"]?\s*$/);
        if (match) {
          globs.push(match[1]);
        } else if (/^\S/.test(line) && line.trim().length > 0) {
          break;
        }
      }
    }
    if (globs.length === 0) globs.push('packages/*');
    return await resolvePackageGlobs(rootPath, globs);
  } catch {
    return [];
  }
}

async function resolveNxPackages(
  rootPath: string,
): Promise<WorkspacePackage[]> {
  // Nx projects live in common dirs
  const candidates = ['apps/*', 'libs/*', 'packages/*'];
  return await resolvePackageGlobs(rootPath, candidates);
}

async function resolveLernaPackages(
  rootPath: string,
  filePath: string,
): Promise<WorkspacePackage[]> {
  try {
    const content = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(content);
    const globs: string[] = Array.isArray(parsed.packages)
      ? parsed.packages
      : ['packages/*'];
    return await resolvePackageGlobs(rootPath, globs);
  } catch {
    return [];
  }
}

async function resolveRushPackages(
  rootPath: string,
  filePath: string,
): Promise<WorkspacePackage[]> {
  try {
    const content = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed.projects)) return [];
    return parsed.projects
      .filter(
        (p: { projectFolder?: string; packageName?: string }) =>
          p.projectFolder,
      )
      .map((p: { projectFolder: string; packageName?: string }) => ({
        name: p.packageName || path.basename(p.projectFolder),
        path: p.projectFolder,
      }));
  } catch {
    return [];
  }
}

async function resolveNpmWorkspaces(
  rootPath: string,
  filePath: string,
): Promise<WorkspacePackage[]> {
  try {
    const content = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(content);
    const workspaces = parsed.workspaces;
    if (!workspaces) return [];
    const globs: string[] = Array.isArray(workspaces)
      ? workspaces
      : (workspaces.packages ?? []);
    if (globs.length === 0) return [];
    return await resolvePackageGlobs(rootPath, globs);
  } catch {
    return [];
  }
}

async function resolvePackageGlobs(
  rootPath: string,
  globs: string[],
): Promise<WorkspacePackage[]> {
  const dirs = await fg(globs, {
    cwd: rootPath,
    onlyDirectories: true,
    deep: 1,
  });
  return dirs.sort().map((dir) => ({
    name: path.basename(dir),
    path: dir.split(path.sep).join('/'),
  }));
}
