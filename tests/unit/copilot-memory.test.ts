import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  hasCopilotMemory,
  installCopilotMemory,
  readCopilotMemory,
  removeCopilotMemory,
  resolveCopilotMemoryDir,
} from '../../src/integrations/copilot-memory.js';

describe('copilot-memory', () => {
  let tempDir: string;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'kgraph-mem-test-'));
    originalEnv = process.env['KGRAPH_COPILOT_MEMORY_DIR'];
    process.env['KGRAPH_COPILOT_MEMORY_DIR'] = tempDir;
  });

  afterEach(async () => {
    if (originalEnv === undefined) {
      delete process.env['KGRAPH_COPILOT_MEMORY_DIR'];
    } else {
      process.env['KGRAPH_COPILOT_MEMORY_DIR'] = originalEnv;
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  it('resolveCopilotMemoryDir respects env override', () => {
    expect(resolveCopilotMemoryDir()).toBe(tempDir);
  });

  it('resolveCopilotMemoryDir returns platform path without override', () => {
    delete process.env['KGRAPH_COPILOT_MEMORY_DIR'];
    const dir = resolveCopilotMemoryDir();
    expect(dir).toBeDefined();
    expect(dir).toContain('github.copilot-chat');
  });

  it('installCopilotMemory writes kgraph.md', async () => {
    const result = await installCopilotMemory();
    expect(result).toBe(true);

    const content = await readFile(path.join(tempDir, 'kgraph.md'), 'utf8');
    expect(content).toContain('# KGraph');
    expect(content).toContain('copilot-instructions.md');
    expect(content).toContain('@kgraph agent');
  });

  it('installCopilotMemory overwrites on re-install', async () => {
    await installCopilotMemory();
    await installCopilotMemory();
    const content = await readCopilotMemory();
    expect(content).toContain('KGraph is installed');
  });

  it('removeCopilotMemory deletes the file', async () => {
    await installCopilotMemory();
    expect(await hasCopilotMemory()).toBe(true);

    await removeCopilotMemory();
    expect(await hasCopilotMemory()).toBe(false);
  });

  it('removeCopilotMemory succeeds when file missing', async () => {
    expect(await removeCopilotMemory()).toBe(true);
  });

  it('hasCopilotMemory returns false initially', async () => {
    expect(await hasCopilotMemory()).toBe(false);
  });

  it('readCopilotMemory returns undefined when no file', async () => {
    expect(await readCopilotMemory()).toBeUndefined();
  });
});
