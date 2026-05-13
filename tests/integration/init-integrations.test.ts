import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import {
  cleanupTempRepo,
  createTempRepo,
  runCli,
} from '../fixtures/helpers.js';

describe('kgraph init integrations', () => {
  it('creates workspace and selected integration instruction files', async () => {
    const repo = await createTempRepo();
    try {
      const result = await runCli(repo, [
        'init',
        '--integrations',
        'codex,cursor',
      ]);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain(
        'Configured integrations: codex:always, cursor:always',
      );

      await access(path.join(repo, 'AGENTS.md'));
      await access(path.join(repo, '.agents', 'skills', 'kgraph', 'SKILL.md'));
      await access(path.join(repo, '.cursor', 'rules', 'kgraph.mdc'));
      await expect(
        access(
          path.join(repo, '.agents', 'skills', 'kgraph-update', 'SKILL.md'),
        ),
      ).rejects.toThrow();
      await expect(
        access(path.join(repo, '.agents', 'skills', 'kgraph-scan', 'SKILL.md')),
      ).rejects.toThrow();
      await expect(
        access(path.join(repo, '.cursor', 'rules', 'kgraph-commands.mdc')),
      ).rejects.toThrow();

      const config = YAML.parse(
        await readFile(path.join(repo, '.kgraph', 'config.yaml'), 'utf8'),
      );
      expect(
        config.integrations.map((item: { name: string }) => item.name),
      ).toEqual(['codex', 'cursor']);
      expect(
        config.integrations.map((item: { mode: string }) => item.mode),
      ).toEqual(['always', 'always']);
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});
