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
        '.github/prompts/kgraph.prompt.md',
        'old duplicate full workflow prompt\n',
      );
      await writeText(
        repo,
        '.agents/skills/kgraph-scan/SKILL.md',
        'old duplicate skill\n',
      );

      const add = await runCli(repo, ['integrate', 'add', 'codex', 'copilot']);
      expect(add.code).toBe(0);
      expect(add.stdout).toContain(
        'Configured integrations: codex:smart, copilot:smart',
      );

      const list = await runCli(repo, ['integrate', 'list']);
      expect(list.stdout).toContain('codex enabled smart AGENTS.md present');
      expect(list.stdout).toContain(
        'copilot enabled smart .github/copilot-instructions.md present',
      );

      const agents = await readFile(path.join(repo, 'AGENTS.md'), 'utf8');
      expect(agents).toContain('Existing Codex guidance');
      expect(agents).toContain('BEGIN KGRAPH codex');
      expect(agents).toContain('For repo-specific coding');
      await access(path.join(repo, '.github', 'copilot-instructions.md'));
      await access(
        path.join(repo, '.github', 'prompts', 'kgraph-scan.prompt.md'),
      );
      await access(
        path.join(repo, '.github', 'prompts', 'kgraph-doctor.prompt.md'),
      );
      await access(
        path.join(repo, '.github', 'prompts', 'kgraph-repair.prompt.md'),
      );
      await access(
        path.join(repo, '.github', 'prompts', 'kgraph-compact.prompt.md'),
      );
      await access(
        path.join(repo, '.github', 'prompts', 'kgraph-conclude.prompt.md'),
      );
      await access(
        path.join(repo, '.github', 'prompts', 'kgraph-update.prompt.md'),
      );
      await access(path.join(repo, '.agents', 'skills', 'kgraph', 'SKILL.md'));
      await runCli(repo, ['integrate', 'add', 'claude-code']);
      await access(
        path.join(repo, '.claude', 'hooks', 'kgraph-session-start.cjs'),
      );
      await access(
        path.join(repo, '.claude', 'commands', 'kgraph-compact.md'),
      );
      await access(
        path.join(repo, '.claude', 'commands', 'kgraph-conclude.md'),
      );
      await access(
        path.join(repo, '.claude', 'hooks', 'kgraph-session-pre-read.cjs'),
      );
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
        access(path.join(repo, '.github', 'prompts', 'kgraph-scan.prompt.md')),
      ).rejects.toThrow();
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});
