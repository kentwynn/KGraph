import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  cleanupTempRepo,
  copyFixture,
  runCli,
} from '../fixtures/helpers.js';

describe('kgraph knowledge', () => {
  it('creates atoms from conclude and supports list/get/archive/supersede', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      await runCli(repo, ['init']);
      await runCli(repo, ['scan']);
      await runCli(repo, [
        'conclude',
        'auth atom one',
        '--type',
        'finding',
        '--confidence',
        'high',
        '--domain',
        'auth',
        '--file',
        'src/auth.ts',
        '--symbol',
        'loginUser',
        '--note',
        'loginUser owns the auth entrypoint.',
      ]);
      await runCli(repo, [
        'conclude',
        'auth atom two',
        '--type',
        'decision',
        '--confidence',
        'medium',
        '--domain',
        'auth',
        '--file',
        'src/session.ts',
        '--note',
        'Refresh handling stays separate from login.',
      ]);

      const list = JSON.parse(
        (await runCli(repo, ['knowledge', 'list', '--topic', 'auth atom', '--json']))
          .stdout,
      );
      expect(list).toHaveLength(2);
      expect(list[0].evidenceRefs.length).toBeGreaterThan(0);
      expect(list[0].provenance.sourceCommand).toBe('conclude');

      const firstId = list[0].id;
      const secondId = list[1].id;
      const get = await runCli(repo, ['knowledge', 'get', firstId]);
      expect(get.stdout).toContain('Evidence:');
      expect(get.stdout).toContain('Provenance:');

      const supersede = await runCli(repo, [
        'knowledge',
        'supersede',
        firstId,
        secondId,
        '--json',
      ]);
      expect(JSON.parse(supersede.stdout).old.lifecycle.supersededBy).toBe(
        secondId,
      );

      const archived = JSON.parse(
        (await runCli(repo, ['knowledge', 'archive', secondId, '--json'])).stdout,
      );
      expect(archived.status).toBe('archived');
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('migrates old cognition notes into compatibility atoms idempotently', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      await runCli(repo, ['init']);
      await runCli(repo, ['scan']);
      await mkdir(path.join(repo, '.kgraph', 'cognition'), { recursive: true });
      const oldNote = {
        id: 'old-auth-note',
        title: 'Old Auth Note',
        tags: [],
        sections: { Summary: 'Old note body.' },
        relatedFiles: ['src/auth.ts'],
        relatedSymbols: [],
        warnings: [],
        sourceInboxPath: '',
        processedPath: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        referencesStatus: 'current',
      };
      await writeFile(
        path.join(repo, '.kgraph', 'cognition', 'old-auth-note.md'),
        `# Old Auth Note\n\n## KGraph Metadata\n\n\`\`\`json\n${JSON.stringify(oldNote, null, 2)}\n\`\`\`\n`,
        'utf8',
      );

      const first = JSON.parse(
        (await runCli(repo, ['knowledge', 'list', '--topic', 'Old Auth', '--json']))
          .stdout,
      );
      const second = JSON.parse(
        (await runCli(repo, ['knowledge', 'list', '--topic', 'Old Auth', '--json']))
          .stdout,
      );
      expect(first).toHaveLength(1);
      expect(second).toHaveLength(1);
      expect(first[0].id).toBe('legacy-old-auth-note');
      expect(first[0].type).toBe('summary');
      expect(first[0].confidence).toBe('medium');
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('builds budget-aware context packs with atom reasons', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      await runCli(repo, ['init']);
      await runCli(repo, ['scan']);
      await runCli(repo, [
        'conclude',
        'auth pack atom',
        '--type',
        'finding',
        '--file',
        'src/auth.ts',
        '--note',
        'Auth pack atom should appear in context packs.',
      ]);
      const pack = JSON.parse(
        (await runCli(repo, ['pack', 'auth pack atom', '--budget', '800', '--json']))
          .stdout,
      );
      expect(pack.usedTokens).toBeLessThanOrEqual(800);
      expect(pack.items.some((item: { kind: string }) => item.kind === 'atom')).toBe(
        true,
      );
      expect(pack.items[0].reasons.length).toBeGreaterThan(0);
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('refreshes stale atom status and reports atom blame', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      await runCli(repo, ['init']);
      await runCli(repo, ['scan']);
      await runCli(repo, [
        'conclude',
        'auth stale atom',
        '--type',
        'finding',
        '--confidence',
        'high',
        '--file',
        'src/auth.ts',
        '--note',
        'Auth stale atom tracks auth.ts evidence.',
      ]);
      const atoms = JSON.parse(
        (await runCli(repo, ['knowledge', 'list', '--topic', 'auth stale atom', '--json']))
          .stdout,
      );
      await writeFile(
        path.join(repo, 'src', 'auth.ts'),
        `${await readFile(path.join(repo, 'src', 'auth.ts'), 'utf8')}\nexport const changedForStale = true;\n`,
        'utf8',
      );
      await runCli(repo, ['scan']);

      const stale = JSON.parse((await runCli(repo, ['stale', '--json'])).stdout);
      const staleAtom = stale.atoms.find(
        (atom: { id: string }) => atom.id === atoms[0].id,
      );
      expect(staleAtom.status).toBe('needs-review');
      expect(staleAtom.confidence).toBe('medium');
      expect(staleAtom.lifecycle.invalidatedBy).toContain('changed file:src/auth.ts');

      const blame = JSON.parse(
        (await runCli(repo, ['blame', atoms[0].id, '--json'])).stdout,
      );
      expect(blame.provenance.sourceCommand).toBe('conclude');
      expect(blame.evidenceRefs.some((ref: { type: string }) => ref.type === 'file')).toBe(
        true,
      );
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('doctor reports invalid atom JSONL', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      await runCli(repo, ['init']);
      await writeFile(
        path.join(repo, '.kgraph', 'knowledge', 'atoms.jsonl'),
        '{bad json}\n',
        'utf8',
      );
      const doctor = await runCli(repo, ['doctor']);
      expect(doctor.code).toBe(1);
      expect(doctor.stdout).toContain('FAIL  knowledge');
      expect(doctor.stdout).toContain('Invalid atoms.jsonl');
      const raw = await readFile(
        path.join(repo, '.kgraph', 'knowledge', 'atoms.jsonl'),
        'utf8',
      );
      expect(raw).toBe('{bad json}\n');
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});
