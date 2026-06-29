import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createProgram } from '../../src/cli/index.js';

export async function createTempRepo(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'kgraph-test-'));
}

export async function copyFixture(name: string): Promise<string> {
  const target = await createTempRepo();
  await cp(path.join(process.cwd(), 'tests', 'fixtures', name), target, {
    recursive: true,
  });
  return target;
}

export async function cleanupTempRepo(repoPath: string): Promise<void> {
  await rm(repoPath, {
    recursive: true,
    force: true,
    maxRetries: 3,
    retryDelay: 200,
  });
}

export async function runCli(
  repoPath: string,
  args: string[],
): Promise<{ stdout: string; stderr: string; code: number }> {
  const originalCwd = process.cwd();
  const originalStdout = process.stdout.write;
  const originalStderr = process.stderr.write;
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalExitCode = process.exitCode;
  const originalDisableMachineDetection =
    process.env.KGRAPH_DISABLE_MACHINE_DETECTION;
  const originalCopilotMemoryDir = process.env.KGRAPH_COPILOT_MEMORY_DIR;
  const originalVSCodeMcpConfig = process.env.KGRAPH_VSCODE_MCP_CONFIG;
  const originalMcpCommand = process.env.KGRAPH_MCP_COMMAND;
  let stdout = '';
  let stderr = '';
  process.chdir(repoPath);
  process.exitCode = undefined;
  process.env.KGRAPH_DISABLE_MACHINE_DETECTION = '1';
  process.env.KGRAPH_COPILOT_MEMORY_DIR = path.join(
    os.tmpdir(),
    'kgraph-memory-test-' + path.basename(repoPath),
  );
  process.env.KGRAPH_VSCODE_MCP_CONFIG = path.join(
    os.tmpdir(),
    'kgraph-vscode-mcp-test-' + path.basename(repoPath),
    'mcp.json',
  );
  process.env.KGRAPH_MCP_COMMAND = 'kgraph';
  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdout += chunk.toString();
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderr += chunk.toString();
    return true;
  }) as typeof process.stderr.write;
  console.log = (...items: unknown[]) => {
    stdout += `${items.map(String).join(' ')}\n`;
  };
  console.error = (...items: unknown[]) => {
    stderr += `${items.map(String).join(' ')}\n`;
  };

  try {
    await createProgram().parseAsync(['node', 'kgraph', ...args], {
      from: 'node',
    });
    return {
      stdout,
      stderr,
      code: typeof process.exitCode === 'number' ? process.exitCode : 0,
    };
  } finally {
    process.stdout.write = originalStdout;
    process.stderr.write = originalStderr;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exitCode = originalExitCode;
    if (originalDisableMachineDetection === undefined) {
      delete process.env.KGRAPH_DISABLE_MACHINE_DETECTION;
    } else {
      process.env.KGRAPH_DISABLE_MACHINE_DETECTION =
        originalDisableMachineDetection;
    }
    if (originalCopilotMemoryDir === undefined) {
      delete process.env.KGRAPH_COPILOT_MEMORY_DIR;
    } else {
      process.env.KGRAPH_COPILOT_MEMORY_DIR = originalCopilotMemoryDir;
    }
    if (originalVSCodeMcpConfig === undefined) {
      delete process.env.KGRAPH_VSCODE_MCP_CONFIG;
    } else {
      process.env.KGRAPH_VSCODE_MCP_CONFIG = originalVSCodeMcpConfig;
    }
    if (originalMcpCommand === undefined) {
      delete process.env.KGRAPH_MCP_COMMAND;
    } else {
      process.env.KGRAPH_MCP_COMMAND = originalMcpCommand;
    }
    process.chdir(originalCwd);
  }
}

export async function readJson<T>(
  repoPath: string,
  relativePath: string,
): Promise<T> {
  return JSON.parse(
    await readFile(path.join(repoPath, relativePath), 'utf8'),
  ) as T;
}

export async function writeText(
  repoPath: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const fullPath = path.join(repoPath, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, 'utf8');
}
