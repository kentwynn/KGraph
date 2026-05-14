import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  cleanupTempRepo,
  createTempRepo,
  runCli,
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

      const add = await runCli(repo, ['integrate', 'add', 'codex', 'copilot']);
      expect(add.code).toBe(0);
      expect(add.stdout).toContain(
        'Configured integrations: codex:always, copilot:always',
      );

      const list = await runCli(repo, ['integrate', 'list']);
      expect(list.stdout).toContain('codex enabled always AGENTS.md present');
      expect(list.stdout).toContain(
        'copilot enabled always .github/copilot-instructions.md present',
      );

      const agents = await readFile(path.join(repo, 'AGENTS.md'), 'utf8');
      expect(agents).toContain('Existing Codex guidance');
      expect(agents).toContain('BEGIN KGRAPH codex');
      expect(agents).toContain('Every chat in this repository');
      await access(path.join(repo, '.github', 'copilot-instructions.md'));
      await access(path.join(repo, '.agents', 'skills', 'kgraph', 'SKILL.md'));
      await access(
        path.join(repo, '.agents', 'skills', 'kgraph-scan', 'SKILL.md'),
      );
      await access(
        path.join(repo, '.agents', 'skills', 'kgraph-doctor', 'SKILL.md'),
      );
      await access(
        path.join(repo, '.agents', 'skills', 'kgraph-repair', 'SKILL.md'),
      );
      await access(
        path.join(repo, '.agents', 'skills', 'kgraph-compact', 'SKILL.md'),
      );
      await access(
        path.join(repo, '.agents', 'skills', 'kgraph-pack', 'SKILL.md'),
      );
      await access(
        path.join(repo, '.agents', 'skills', 'kgraph-knowledge', 'SKILL.md'),
      );
      await access(
        path.join(repo, '.agents', 'skills', 'kgraph-stale', 'SKILL.md'),
      );
      await access(
        path.join(repo, '.agents', 'skills', 'kgraph-blame', 'SKILL.md'),
      );
      await access(
        path.join(repo, '.agents', 'skills', 'kgraph-conclude', 'SKILL.md'),
      );
      await access(
        path.join(repo, '.agents', 'skills', 'kgraph-update', 'SKILL.md'),
      );
      await runCli(repo, ['integrate', 'add', 'claude-code']);
      await access(
        path.join(repo, '.claude', 'hooks', 'kgraph-session-start.cjs'),
      );
      await access(path.join(repo, '.claude', 'commands', 'kgraph-compact.md'));
      await access(path.join(repo, '.claude', 'commands', 'kgraph-pack.md'));
      await access(
        path.join(repo, '.claude', 'commands', 'kgraph-knowledge.md'),
      );
      await access(path.join(repo, '.claude', 'commands', 'kgraph-stale.md'));
      await access(path.join(repo, '.claude', 'commands', 'kgraph-blame.md'));
      await access(
        path.join(repo, '.claude', 'commands', 'kgraph-conclude.md'),
      );
      await access(
        path.join(repo, '.claude', 'hooks', 'kgraph-session-pre-read.cjs'),
      );

      const remove = await runCli(repo, ['integrate', 'remove', 'codex']);
      expect(remove.code).toBe(0);
      expect(remove.stdout).toContain('Removed integrations: codex');

      const after = await readFile(path.join(repo, 'AGENTS.md'), 'utf8');
      expect(after).toBe('Existing Codex guidance\n');
      expect(after).not.toContain('BEGIN KGRAPH codex');
      // Skills still exist because copilot is still enabled and shares them
      await access(path.join(repo, '.agents', 'skills', 'kgraph', 'SKILL.md'));
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('adds, lists, and removes Gemini, Windsurf, and Cline integrations', async () => {
    const repo = await createTempRepo();
    try {
      await runCli(repo, ['init']);
      await writeFile(
        path.join(repo, 'GEMINI.md'),
        'Existing Gemini guidance\n',
        'utf8',
      );

      const add = await runCli(repo, [
        'integrate',
        'add',
        '--mode',
        'always',
        'gemini',
        'windsurf',
        'cline',
      ]);
      expect(add.code).toBe(0);
      expect(add.stdout).toContain(
        'Configured integrations: gemini:always, windsurf:always, cline:always',
      );

      const list = await runCli(repo, ['integrate', 'list']);
      expect(list.stdout).toContain('gemini enabled always GEMINI.md present');
      expect(list.stdout).toContain(
        'windsurf enabled always .windsurf/rules/kgraph.md present',
      );
      expect(list.stdout).toContain(
        'cline enabled always .clinerules/kgraph.md present',
      );

      const gemini = await readFile(path.join(repo, 'GEMINI.md'), 'utf8');
      expect(gemini).toContain('Existing Gemini guidance');
      expect(gemini).toContain('BEGIN KGRAPH gemini');
      expect(gemini).toContain('Every chat in this repository must start');
      await access(path.join(repo, '.windsurf', 'rules', 'kgraph.md'));
      await access(path.join(repo, '.clinerules', 'kgraph.md'));

      const remove = await runCli(repo, [
        'integrate',
        'remove',
        'gemini',
        'windsurf',
        'cline',
      ]);
      expect(remove.code).toBe(0);
      expect(remove.stdout).toContain(
        'Removed integrations: cline, gemini, windsurf',
      );

      const afterGemini = await readFile(path.join(repo, 'GEMINI.md'), 'utf8');
      expect(afterGemini).toBe('Existing Gemini guidance\n');
      await expect(
        access(path.join(repo, '.windsurf', 'rules', 'kgraph.md')),
      ).rejects.toThrow();
      await expect(
        access(path.join(repo, '.clinerules', 'kgraph.md')),
      ).rejects.toThrow();
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('sets integration modes and disables generated instructions with off', async () => {
    const repo = await createTempRepo();
    try {
      await runCli(repo, ['init']);
      await runCli(repo, ['integrate', 'add', 'copilot']);

      const manual = await runCli(repo, [
        'integrate',
        'set',
        'copilot',
        '--mode',
        'manual',
      ]);
      expect(manual.code).toBe(0);
      expect(manual.stdout).toContain('Updated integrations: copilot:manual');

      const instructions = await readFile(
        path.join(repo, '.github', 'copilot-instructions.md'),
        'utf8',
      );
      expect(instructions).toContain('Do not run KGraph automatically');

      const off = await runCli(repo, [
        'integrate',
        'set',
        'copilot',
        '--mode',
        'off',
      ]);
      expect(off.code).toBe(0);
      expect(off.stdout).toContain('Updated integrations: copilot:off');

      const list = await runCli(repo, ['integrate', 'list']);
      expect(list.stdout).toContain(
        'copilot disabled off .github/copilot-instructions.md missing',
      );
      await expect(
        access(path.join(repo, '.github', 'copilot-instructions.md')),
      ).rejects.toThrow();
      await expect(
        access(path.join(repo, '.agents', 'skills', 'kgraph-scan', 'SKILL.md')),
      ).rejects.toThrow();
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});
