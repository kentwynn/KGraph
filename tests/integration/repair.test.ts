import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cleanupTempRepo, copyFixture, runCli } from '../fixtures/helpers.js';
import type { CognitionNote } from '../../src/types/cognition.js';

describe('kgraph repair', () => {
  it('previews and removes noisy stale cognition references', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      await runCli(repo, ['init']);
      await runCli(repo, ['scan']);
      const note: CognitionNote = {
        title: 'Auth Cleanup',
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
        referencesStatus: 'mixed',
      };
      await mkdir(path.join(repo, '.kgraph/cognition'), { recursive: true });
      await writeFile(
        path.join(repo, '.kgraph/cognition/auth-cleanup.md'),
        `# Auth Cleanup\n\n## KGraph Metadata\n\n\`\`\`json\n${JSON.stringify(note, null, 2)}\n\`\`\`\n`,
      );

      const dryRun = await runCli(repo, ['repair', '--dry-run']);
      expect(dryRun.stdout).toContain('remove file ref: Next.js');
      expect(dryRun.stdout).toContain('remove symbol ref: className');

      const repair = await runCli(repo, ['repair']);
      expect(repair.code).toBe(0);
      expect(repair.stdout).toContain('KGraph Repair');

      const repaired = await readCognition(repo, 'auth-cleanup.md');
      expect(repaired.relatedFiles).toEqual(['src/auth.ts']);
      expect(repaired.relatedSymbols).toEqual(['loginUser']);
      expect(repaired.referencesStatus).toBe('current');
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});

async function readCognition(repo: string, fileName: string): Promise<CognitionNote> {
  const raw = await readJsonFromMarkdown(
    path.join(repo, '.kgraph/cognition', fileName),
  );
  return raw as CognitionNote;
}

async function readJsonFromMarkdown(filePath: string): Promise<unknown> {
  const { readFile } = await import('node:fs/promises');
  const raw = await readFile(filePath, 'utf8');
  const match = raw.match(/```json\n([\s\S]*?)\n```/);
  if (!match) throw new Error('Missing metadata JSON');
  return JSON.parse(match[1]);
}
