import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CognitionNote } from '../../src/types/cognition.js';
import { cleanupTempRepo, copyFixture, runCli } from '../fixtures/helpers.js';

describe('kgraph repair', () => {
  it('previews and removes noisy stale cognition references', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      await runCli(repo, ['init']);
      await runCli(repo, ['scan']);
      const note: CognitionNote = {
        title: 'Auth Cleanup',
        kind: 'finding',
        confidence: 'medium',
        tags: [],
        summary: 'Auth note with noisy refs.',
        sections: { Summary: 'Auth note with noisy refs.' },
        relatedFiles: ['src/auth.ts', 'Next.js'],
        relatedSymbols: ['loginUser', 'className'],
        warnings: [],
        id: 'auth-cleanup',
        sourceInboxPath: '.kgraph/inbox/auth-cleanup.md',
        processedPath: '.kgraph/interactions/processed/auth-cleanup.md',
        createdAt: new Date().toISOString(),
        source: 'inbox',
        referencesStatus: 'mixed',
      };
      await mkdir(path.join(repo, '.kgraph/cognition'), { recursive: true });
      await writeFile(
        path.join(repo, '.kgraph/cognition/auth-cleanup.md'),
        `# Auth Cleanup\n\n## KGraph Metadata\n\n\`\`\`json\n${JSON.stringify(note, null, 2)}\n\`\`\`\n`,
      );

      const dryRun = await runCli(repo, ['repair', '--dry-run']);
      expect(dryRun.stdout).toContain('remove file ref: Next.js');
      // className has uppercase and looks like a real identifier — preserved for human review,
      // not auto-deleted (it may have been renamed rather than removed)
      expect(dryRun.stdout).not.toContain('remove symbol ref: className');

      const repair = await runCli(repo, ['repair']);
      expect(repair.code).toBe(0);
      expect(repair.stdout).toContain('KGraph Repair');

      const atoms = JSON.parse(
        (await runCli(repo, ['knowledge', 'list', '--topic', 'Auth Cleanup', '--json']))
          .stdout,
      );
      expect(atoms).toHaveLength(1);
      const repaired = atoms[0];
      expect(repaired.type).toBe('finding');
      expect(repaired.confidence).toBe('medium');
      expect(repaired.provenance.sourceCommand).toBe('legacy-migration');
      expect(repaired.scopeRefs.files).toEqual(['src/auth.ts']);
      // loginUser exists in the fixture; className is camelCase so it is preserved
      expect(repaired.scopeRefs.symbols).toEqual(['loginUser', 'className']);
      expect(repaired.status).toBe('needs-review');
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});
