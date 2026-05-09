import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  cleanupTempRepo,
  createTempRepo,
  runCli,
  writeText,
} from '../fixtures/helpers.js';

describe('kgraph integrate', () => {
  it('adds, lists, and removes integrations without deleting user content', async () => {
    const repo = await createTempRepo();
    try {
      await runCli(repo, ['init']);
      await writeFile(
        path.join(repo, 'AGENTS.md'),
        'Existing Codex guidance\n',
        'utf8',
      );
      await writeText(
        repo,
        '.github/prompts/kgraph-update.prompt.md',
        'old duplicate prompt\n',
      );
      await writeText(
        repo,
        '.agents/skills/kgraph-scan/SKILL.md',
        'old duplicate skill\n',
      );

      const add = await runCli(repo, ['integrate', 'add', 'codex', 'copilot']);
      expect(add.code).toBe(0);
      expect(add.stdout).toContain('Configured integrations: codex, copilot');

      const list = await runCli(repo, ['integrate', 'list']);
      expect(list.stdout).toContain('codex enabled AGENTS.md present');
      expect(list.stdout).toContain(
        'copilot enabled .github/copilot-instructions.md present',
      );

      const agents = await readFile(path.join(repo, 'AGENTS.md'), 'utf8');
      expect(agents).toContain('Existing Codex guidance');
      expect(agents).toContain('BEGIN KGRAPH codex');
      await access(path.join(repo, '.github', 'copilot-instructions.md'));
      await access(
        path.join(repo, '.github', 'prompts', 'kgraph-scan.prompt.md'),
      );
      await access(
        path.join(repo, '.github', 'prompts', 'kgraph-update.prompt.md'),
      );
      await access(path.join(repo, '.agents', 'skills', 'kgraph', 'SKILL.md'));
      // kgraph.prompt.md is obsolete — should be deleted on integrate
      await expect(
        access(path.join(repo, '.github', 'prompts', 'kgraph.prompt.md')),
      ).rejects.toThrow();
      await expect(
        access(
          path.join(repo, '.agents', 'skills', 'kgraph-update', 'SKILL.md'),
        ),
      ).rejects.toThrow();
      await expect(
        access(path.join(repo, '.agents', 'skills', 'kgraph-scan', 'SKILL.md')),
      ).rejects.toThrow();

      const remove = await runCli(repo, ['integrate', 'remove', 'codex']);
      expect(remove.code).toBe(0);
      expect(remove.stdout).toContain('Removed integrations: codex');

      const after = await readFile(path.join(repo, 'AGENTS.md'), 'utf8');
      expect(after).toBe('Existing Codex guidance\n');
      expect(after).not.toContain('BEGIN KGRAPH codex');
      await expect(
        access(path.join(repo, '.agents', 'skills', 'kgraph', 'SKILL.md')),
      ).rejects.toThrow();
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});
