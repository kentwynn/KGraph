import { access, readFile, writeFile } from 'node:fs/promises';
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

  it('removes legacy generated Copilot agent files during full uninstall', async () => {
    const repo = await createTempRepo();
    try {
      await runCli(repo, ['init', '--integration', 'copilot']);
      await writeText(
        repo,
        '.github/agents/kgraph.agent.md',
        'old Copilot custom agent\n',
      );

      const apply = await runCli(repo, ['uninstall', '--yes']);
      expect(apply.code).toBe(0);
      await expect(access(path.join(repo, '.kgraph'))).rejects.toThrow();
      await expect(
        access(path.join(repo, '.github', 'agents', 'kgraph.agent.md')),
      ).rejects.toThrow();

      const initAgain = await runCli(repo, ['init']);
      expect(initAgain.code).toBe(0);
      await expect(
        access(path.join(repo, '.github', 'agents', 'kgraph.agent.md')),
      ).rejects.toThrow();
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});
