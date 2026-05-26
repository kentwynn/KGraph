/**
 * Manages the GitHub Copilot memory-tool entry for KGraph.
 * Installs/removes a persistent preference so Copilot always follows the
 * KGraph workflow in repos where KGraph is initialised.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir, platform } from 'node:os';
import path from 'node:path';
import { pathExists } from '../storage/kgraph-paths.js';

const MEMORY_FILE = 'kgraph.md';

const MEMORY_CONTENT = `# KGraph

- KGraph is installed. Follow the copilot-instructions.md and @kgraph agent for this repo.
`;

/**
 * Resolve the Copilot memory-tool memories directory for the current OS.
 * Returns undefined if the globalStorage root cannot be determined.
 * Respects KGRAPH_COPILOT_MEMORY_DIR env override for testing.
 */
export function resolveCopilotMemoryDir(): string | undefined {
  if (process.env['KGRAPH_COPILOT_MEMORY_DIR']) {
    return process.env['KGRAPH_COPILOT_MEMORY_DIR'];
  }
  const home = homedir();
  switch (platform()) {
    case 'win32':
      return path.join(
        process.env['APPDATA'] ?? path.join(home, 'AppData', 'Roaming'),
        'Code',
        'User',
        'globalStorage',
        'github.copilot-chat',
        'memory-tool',
        'memories',
      );
    case 'darwin':
      return path.join(
        home,
        'Library',
        'Application Support',
        'Code',
        'User',
        'globalStorage',
        'github.copilot-chat',
        'memory-tool',
        'memories',
      );
    case 'linux':
      return path.join(
        process.env['XDG_CONFIG_HOME'] ?? path.join(home, '.config'),
        'Code',
        'User',
        'globalStorage',
        'github.copilot-chat',
        'memory-tool',
        'memories',
      );
    default:
      return undefined;
  }
}

/**
 * Install the KGraph memory entry into the Copilot memory store.
 * Returns true if written, false if the directory could not be resolved.
 */
export async function installCopilotMemory(): Promise<boolean> {
  const memoryDir = resolveCopilotMemoryDir();
  if (!memoryDir) {
    return false;
  }
  await mkdir(memoryDir, { recursive: true });
  await writeFile(path.join(memoryDir, MEMORY_FILE), MEMORY_CONTENT, 'utf8');
  return true;
}

/**
 * Remove the KGraph memory entry from the Copilot memory store.
 * Returns true if removed or did not exist, false if the directory could not be resolved.
 */
export async function removeCopilotMemory(): Promise<boolean> {
  const memoryDir = resolveCopilotMemoryDir();
  if (!memoryDir) {
    return false;
  }
  const memoryFile = path.join(memoryDir, MEMORY_FILE);
  if (await pathExists(memoryFile)) {
    await rm(memoryFile, { force: true });
  }
  return true;
}

/**
 * Check whether the KGraph memory entry exists.
 */
export async function hasCopilotMemory(): Promise<boolean> {
  const memoryDir = resolveCopilotMemoryDir();
  if (!memoryDir) {
    return false;
  }
  return pathExists(path.join(memoryDir, MEMORY_FILE));
}

/**
 * Read the KGraph memory content, if it exists.
 */
export async function readCopilotMemory(): Promise<string | undefined> {
  const memoryDir = resolveCopilotMemoryDir();
  if (!memoryDir) {
    return undefined;
  }
  const memoryFile = path.join(memoryDir, MEMORY_FILE);
  if (!(await pathExists(memoryFile))) {
    return undefined;
  }
  return readFile(memoryFile, 'utf8');
}
