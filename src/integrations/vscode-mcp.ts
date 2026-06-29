import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { KGraphError } from '../cli/errors.js';
import type { KGraphWorkspace } from '../types/config.js';

interface VSCodeMcpConfig {
  servers?: Record<string, unknown>;
  inputs?: unknown[];
  [key: string]: unknown;
}

export interface VSCodeMcpInstallResult {
  configPath: string;
  serverName: string;
  command: string;
  args: string[];
  changed: boolean;
}

const SERVER_NAME = 'KGraph';

export async function installVSCodeMcpServer(
  workspace: KGraphWorkspace,
): Promise<VSCodeMcpInstallResult> {
  const configPath = resolveVSCodeMcpConfigPath();
  const command = resolveKGraphMcpCommand();
  const args = ['mcp', '--root', workspace.rootPath];
  const existing = await readVSCodeMcpConfig(configPath);
  const servers = normalizeServers(existing.servers);
  const nextServer = {
    command,
    args,
    type: 'stdio',
  };
  const previous = servers[SERVER_NAME];
  servers[SERVER_NAME] = nextServer;
  const next: VSCodeMcpConfig = {
    ...existing,
    servers,
    inputs: Array.isArray(existing.inputs) ? existing.inputs : [],
  };
  const changed =
    JSON.stringify(previous ?? null) !== JSON.stringify(nextServer);

  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');

  return { configPath, serverName: SERVER_NAME, command, args, changed };
}

export function resolveVSCodeMcpConfigPath(): string {
  if (process.env.KGRAPH_VSCODE_MCP_CONFIG) {
    return process.env.KGRAPH_VSCODE_MCP_CONFIG;
  }

  if (process.platform === 'darwin') {
    return path.join(
      os.homedir(),
      'Library',
      'Application Support',
      'Code',
      'User',
      'mcp.json',
    );
  }

  if (process.platform === 'win32') {
    const appData = process.env.APPDATA;
    if (!appData) {
      throw new KGraphError(
        'APPDATA is not set; cannot locate VS Code MCP config.',
      );
    }
    return path.join(appData, 'Code', 'User', 'mcp.json');
  }

  return path.join(os.homedir(), '.config', 'Code', 'User', 'mcp.json');
}

function resolveKGraphMcpCommand(): string {
  if (process.env.KGRAPH_MCP_COMMAND) {
    return process.env.KGRAPH_MCP_COMMAND;
  }

  const entrypoint = process.argv[1];
  if (entrypoint && path.basename(entrypoint).startsWith('kgraph')) {
    return entrypoint;
  }

  return 'kgraph';
}

async function readVSCodeMcpConfig(
  configPath: string,
): Promise<VSCodeMcpConfig> {
  try {
    return JSON.parse(await readFile(configPath, 'utf8')) as VSCodeMcpConfig;
  } catch (error) {
    if (isMissingFile(error)) {
      return { servers: {}, inputs: [] };
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new KGraphError(
      `Invalid VS Code MCP config at ${configPath}: ${message}`,
    );
  }
}

function normalizeServers(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function isMissingFile(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}
