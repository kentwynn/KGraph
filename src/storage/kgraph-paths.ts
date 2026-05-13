import { access, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import type { KGraphWorkspace } from "../types/config.js";
import { KGraphError } from "../cli/errors.js";

const WORKSPACE_DIRS = [
  "map",
  "cognition",
  "domains",
  "inbox",
  "interactions/processed",
  "context",
  "sessions",
  "knowledge",
  "knowledge/indexes"
] as const;

export function resolveWorkspace(rootPath = process.cwd()): KGraphWorkspace {
  const kgraphPath = path.join(rootPath, ".kgraph");
  return {
    rootPath,
    kgraphPath,
    configPath: path.join(kgraphPath, "config.yaml"),
    mapPath: path.join(kgraphPath, "map"),
    cognitionPath: path.join(kgraphPath, "cognition"),
    domainsPath: path.join(kgraphPath, "domains"),
    inboxPath: path.join(kgraphPath, "inbox"),
    processedInteractionsPath: path.join(kgraphPath, "interactions", "processed"),
    contextPath: path.join(kgraphPath, "context"),
    sessionsPath: path.join(kgraphPath, "sessions"),
    knowledgePath: path.join(kgraphPath, "knowledge")
  };
}

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function assertWorkspace(rootPath = process.cwd()): Promise<KGraphWorkspace> {
  const workspace = resolveWorkspace(rootPath);
  if (!(await pathExists(workspace.kgraphPath))) {
    throw new KGraphError(
      [
        "KGraph is not initialized for this repository.",
        "Run `kgraph init` first, or use `kgraph init --integrations codex,copilot,cursor,claude-code` to initialize and connect common AI tools.",
        "After init, run `kgraph doctor` to verify maps, integrations, and cognition quality.",
      ].join("\n"),
    );
  }

  const info = await stat(workspace.kgraphPath);
  if (!info.isDirectory()) {
    throw new KGraphError(".kgraph exists but is not a directory.");
  }

  return workspace;
}

export async function ensureWorkspace(rootPath = process.cwd()): Promise<KGraphWorkspace> {
  const workspace = resolveWorkspace(rootPath);

  if (await pathExists(workspace.kgraphPath)) {
    const info = await stat(workspace.kgraphPath);
    if (!info.isDirectory()) {
      throw new KGraphError(".kgraph exists but is not a directory.");
    }
  }

  await mkdir(workspace.kgraphPath, { recursive: true });
  for (const dir of WORKSPACE_DIRS) {
    await mkdir(path.join(workspace.kgraphPath, dir), { recursive: true });
  }

  return workspace;
}

export function toRepoPath(rootPath: string, targetPath: string): string {
  return path.relative(rootPath, targetPath).split(path.sep).join("/");
}

export function fromRepoPath(rootPath: string, repoPath: string): string {
  return path.join(rootPath, ...repoPath.split("/"));
}
