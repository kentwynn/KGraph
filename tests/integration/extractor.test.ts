import { describe, expect, it } from 'vitest';
import {
  cleanupTempRepo,
  createTempRepo,
  runCli,
} from '../fixtures/helpers.js';

describe('kgraph extractor', () => {
  it('adds, lists, and removes configured extractors', async () => {
    const repo = await createTempRepo();
    try {
      await runCli(repo, ['init']);

      const add = await runCli(repo, ['extractor', 'add', 'jvm', 'python']);
      expect(add.code).toBe(0);
      expect(add.stdout).toContain('Configured extractors: jvm, python');
      expect(add.stdout).toContain(
        'Install packages: npm install -D @kentwynn/kgraph-extractor-jvm @kentwynn/kgraph-extractor-python',
      );

      const list = await runCli(repo, ['extractor', 'list']);
      expect(list.code).toBe(0);
      expect(list.stdout).toContain(
        'jvm enabled @kentwynn/kgraph-extractor-jvm missing',
      );
      expect(list.stdout).toContain(
        'python enabled @kentwynn/kgraph-extractor-python missing',
      );

      const remove = await runCli(repo, ['extractor', 'remove', 'jvm']);
      expect(remove.code).toBe(0);
      expect(remove.stdout).toContain('Removed extractors: jvm');

      const afterRemove = await runCli(repo, ['extractor', 'list']);
      expect(afterRemove.stdout).not.toContain('jvm enabled');
      expect(afterRemove.stdout).toContain(
        'python enabled @kentwynn/kgraph-extractor-python missing',
      );
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});
