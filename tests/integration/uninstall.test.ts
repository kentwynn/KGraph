import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  cleanupTempRepo,
  createTempRepo,
  runCli,
  writeText,
} from '../fixtures/helpers.js';

describe('kgraph uninstall', () => {
  it('previews by default and removes workspace plus managed integrations with --yes', async () => {
    const repo = await createTempRepo();
    try {
      await runCli(repo, ['init']);
      await writeFile(
        path.join(repo, 'AGENTS.md'),
        'Existing Codex guidance\n',
        'utf8',
      );
      await runCli(repo, ['integrate', 'add', 'codex']);

      const preview = await runCli(repo, ['uninstall']);
      expect(preview.code).toBe(0);
      expect(preview.stdout).toContain('KGraph Uninstall Preview');
      expect(preview.stdout).toContain('.kgraph/ runtime workspace');
      expect(preview.stdout).toContain('codex');
      await access(path.join(repo, '.kgraph'));
      expect(await readFile(path.join(repo, 'AGENTS.md'), 'utf8')).toContain(
        'BEGIN KGRAPH codex',
      );

      const apply = await runCli(repo, ['uninstall', '--yes']);
      expect(apply.code).toBe(0);
      expect(apply.stdout).toContain('KGraph uninstall complete');
      await expect(access(path.join(repo, '.kgraph'))).rejects.toThrow();
      expect(await readFile(path.join(repo, 'AGENTS.md'), 'utf8')).toBe(
        'Existing Codex guidance\n',
      );

      const initAgain = await runCli(repo, ['init']);
      expect(initAgain.code).toBe(0);
      expect(initAgain.stdout).toContain('Initialized .kgraph workspace.');
      await access(path.join(repo, '.kgraph'));
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('can remove only .kgraph while preserving integration files', async () => {
    const repo = await createTempRepo();
    try {
      await runCli(repo, ['init']);
      await runCli(repo, ['integrate', 'add', 'codex']);

      const apply = await runCli(repo, [
        'uninstall',
        '--keep-integrations',
        '--yes',
      ]);
      expect(apply.code).toBe(0);
      await expect(access(path.join(repo, '.kgraph'))).rejects.toThrow();
      expect(await readFile(path.join(repo, 'AGENTS.md'), 'utf8')).toContain(
        'BEGIN KGRAPH codex',
      );
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('removes generated Copilot agent files during full uninstall', async () => {
    const repo = await createTempRepo();
    try {
      await runCli(repo, ['init', '--integration', 'copilot']);
      // Agent file should be generated during init
      await expect(
        access(path.join(repo, '.github', 'agents', 'kgraph.agent.md')),
      ).resolves.toBeUndefined();

      const apply = await runCli(repo, ['uninstall', '--yes']);
      expect(apply.code).toBe(0);
      await expect(access(path.join(repo, '.kgraph'))).rejects.toThrow();
      await expect(
        access(path.join(repo, '.github', 'agents', 'kgraph.agent.md')),
      ).rejects.toThrow();
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('prunes empty generated integration directories during full uninstall', async () => {
    const repo = await createTempRepo();
    try {
      await runCli(repo, ['init']);
      await runCli(repo, ['integrate', 'add', 'codex']);
      await writeText(
        repo,
        '.agents/generated/kgraph.md',
        'legacy generated\n',
      );

      const apply = await runCli(repo, ['uninstall', '--yes']);
      expect(apply.code).toBe(0);
      await expect(access(path.join(repo, '.kgraph'))).rejects.toThrow();
      await expect(access(path.join(repo, '.agents'))).rejects.toThrow();
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('preserves non-KGraph files while pruning empty KGraph rule directories', async () => {
    const repo = await createTempRepo();
    try {
      await runCli(repo, ['init']);
      await runCli(repo, ['integrate', 'add', 'cursor']);
      await mkdir(path.join(repo, '.cursor', 'user'), { recursive: true });
      await writeText(repo, '.cursor/user/keep.md', 'keep me\n');

      const apply = await runCli(repo, ['uninstall', '--yes']);
      expect(apply.code).toBe(0);
      await expect(
        access(path.join(repo, '.cursor', 'rules', 'kgraph.mdc')),
      ).rejects.toThrow();
      await expect(
        access(path.join(repo, '.cursor', 'rules')),
      ).rejects.toThrow();
      expect(
        await readFile(path.join(repo, '.cursor', 'user', 'keep.md'), 'utf8'),
      ).toBe('keep me\n');
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('keeps Copilot memory by default, removes with --memory flag', async () => {
    const repo = await createTempRepo();
    try {
      await writeText(repo, 'src/index.ts', 'export const x = 1;\n');
      await runCli(repo, ['init']);

      const memoryDir = path.join(
        os.tmpdir(),
        'kgraph-memory-test-' + path.basename(repo),
      );
      const memoryFile = path.join(memoryDir, 'kgraph.md');
      await access(memoryFile);

      // Normal uninstall keeps memory
      const normal = await runCli(repo, ['uninstall', '--yes']);
      expect(normal.code).toBe(0);
      expect(normal.stdout).not.toContain('Removed Copilot memory rule');
      await access(memoryFile); // still exists

      // Re-init to test --memory flag
      await runCli(repo, ['init']);

      const withMemory = await runCli(repo, ['uninstall', '--yes', '--memory']);
      expect(withMemory.code).toBe(0);
      expect(withMemory.stdout).toContain('Removed Copilot memory rule');
      await expect(access(memoryFile)).rejects.toThrow();
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});
