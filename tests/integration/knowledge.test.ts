import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import {
  cleanupTempRepo,
  copyFixture,
  runCli,
  writeText,
} from '../fixtures/helpers.js';

const execFileAsync = promisify(execFile);

async function gitInit(repoPath: string): Promise<void> {
  await execFileAsync('git', ['init'], { cwd: repoPath });
  await execFileAsync('git', ['config', 'user.email', 'test@kgraph.test'], {
    cwd: repoPath,
  });
  await execFileAsync('git', ['config', 'user.name', 'KGraph Test'], {
    cwd: repoPath,
  });
}

async function gitCommitAll(repoPath: string, message: string): Promise<void> {
  await execFileAsync('git', ['add', '-A'], { cwd: repoPath });
  await execFileAsync('git', ['commit', '-m', message], { cwd: repoPath });
}

describe('kgraph knowledge', () => {
  it('creates atoms from conclude and supports list/get/archive/supersede', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      await gitInit(repo);
      await gitCommitAll(repo, 'initial');
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
      expect(firstId).toMatch(/^\d{4}-\d{2}-\d{2}T.*-auth-atom-one$/);
      expect(firstId).not.toMatch(/\d{4}-\d{2}-\d{2}t.*\d{4}-\d{2}-\d{2}t/);
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
      const refsAfterSupersede = JSON.parse(
        await readFile(
          path.join(repo, '.kgraph', 'knowledge', 'indexes', 'refs.json'),
          'utf8',
        ),
      );
      expect(refsAfterSupersede['file:src/auth.ts']).toBeUndefined();
      expect(refsAfterSupersede['file:src/session.ts']).toEqual([secondId]);
      const domainAfterSupersede = await readJsonFromMarkdown(
        path.join(repo, '.kgraph', 'domains', 'auth.md'),
      );
      expect(domainAfterSupersede.files).toEqual(['src/session.ts']);
      expect(domainAfterSupersede.cognitionNotes).toEqual([secondId]);

      const archived = JSON.parse(
        (await runCli(repo, ['knowledge', 'archive', secondId, '--json'])).stdout,
      );
      expect(archived.status).toBe('archived');
      const refsAfterArchive = JSON.parse(
        await readFile(
          path.join(repo, '.kgraph', 'knowledge', 'indexes', 'refs.json'),
          'utf8',
        ),
      );
      expect(refsAfterArchive['file:src/session.ts']).toBeUndefined();
      const domainAfterArchive = await readJsonFromMarkdown(
        path.join(repo, '.kgraph', 'domains', 'auth.md'),
      );
      expect(domainAfterArchive.files).toEqual([]);
      expect(domainAfterArchive.cognitionNotes).toEqual([]);
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('infers changed files for bare conclude commands', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      await gitInit(repo);
      await gitCommitAll(repo, 'initial');
      await runCli(repo, ['init']);
      await runCli(repo, ['scan']);
      await writeFile(
        path.join(repo, 'src', 'auth.ts'),
        `${await readFile(path.join(repo, 'src', 'auth.ts'), 'utf8')}\nexport const changedForConclusion = true;\n`,
        'utf8',
      );

      await runCli(repo, [
        'conclude',
        'auth changed conclusion',
        '--type',
        'finding',
        '--confidence',
        'high',
      ]);

      const list = JSON.parse(
        (
          await runCli(repo, [
            'knowledge',
            'list',
            '--topic',
            'auth changed conclusion',
            '--json',
          ])
        ).stdout,
      );
      expect(list[0].scopeRefs.files).toContain('src/auth.ts');
      expect(
        list[0].evidenceRefs.some(
          (ref: { type: string; path?: string }) =>
            ref.type === 'file' && ref.path === 'src/auth.ts',
        ),
      ).toBe(true);
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('rejects high-confidence conclusions without evidence', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      await runCli(repo, ['init']);
      await runCli(repo, ['scan']);
      const result = await runCli(repo, [
        'conclude',
        'unsupported high confidence conclusion',
        '--type',
        'decision',
        '--confidence',
        'high',
      ]);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain(
        'High-confidence cognition requires evidence',
      );
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('warns on medium-confidence conclusions without evidence', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      await runCli(repo, ['init']);
      await runCli(repo, ['scan']);
      const result = await runCli(repo, [
        'conclude',
        'medium confidence conclusion',
        '--type',
        'summary',
        '--confidence',
        'medium',
      ]);

      expect(result.code).toBe(0);
      expect(result.stderr).toContain(
        'Medium-confidence cognition has no file or symbol evidence',
      );
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('doctor flags existing high-confidence atoms without evidence', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      await runCli(repo, ['init']);
      await runCli(repo, ['scan']);
      const now = '2026-01-01T00:00:00.000Z';
      await writeFile(
        path.join(repo, '.kgraph', 'knowledge', 'atoms.jsonl'),
        `${JSON.stringify({
          id: 'bad-high-confidence-atom',
          type: 'decision',
          topic: 'unsupported high confidence conclusion',
          claim: 'High confidence without evidence.',
          confidence: 'high',
          status: 'active',
          evidenceRefs: [],
          scopeRefs: { files: [], symbols: [], domains: [], packages: [] },
          provenance: { sourceCommand: 'conclude', createdAt: now },
          lifecycle: { supersedes: [] },
        })}\n`,
        'utf8',
      );

      const doctor = await runCli(repo, ['doctor', '--quality']);
      expect(doctor.code).toBe(1);
      expect(doctor.stdout).toContain(
        'high-confidence atom(s) without evidence',
      );
      expect(doctor.stdout).toContain(
        'High-confidence atoms without evidence: 1',
      );
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

      const text = await runCli(repo, ['pack', 'auth pack atom', '--budget', '800']);
      expect(text.stdout).toContain('KGraph Pack · auth pack atom');
      expect(text.stdout).toContain('● Budget');
      expect(text.stdout).toContain('● Atoms');
      expect(text.stdout).toContain('machine contract: --json');
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('surfaces pending inbox notes in context packs without processing them', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      await runCli(repo, ['init']);
      await runCli(repo, ['scan']);
      await writeText(
        repo,
        '.kgraph/inbox/history-routing.md',
        `---
type: finding
confidence: medium
---
# History Routing Smoke

## Summary
Pack should warn when inbox notes are pending because history does not see them until update processes them.

## Key Files
- \`src/auth.ts\` - smoke evidence
`,
      );

      const pack = JSON.parse(
        (
          await runCli(repo, [
            'pack',
            'history routing smoke',
            '--budget',
            '800',
            '--json',
            '--agent',
            'copilot',
          ])
        ).stdout,
      );
      expect(pack.pendingInbox).toEqual({
        count: 1,
        files: ['.kgraph/inbox/history-routing.md'],
      });
      expect(pack.warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Pending inbox notes are not processed by pack'),
        ]),
      );

      const historyBefore = await runCli(repo, ['history', 'History Routing']);
      expect(historyBefore.stdout).toContain('No processed cognition notes found');

      const text = await runCli(repo, [
        'pack',
        'history routing smoke',
        '--budget',
        '800',
      ]);
      expect(text.stdout).toContain('Pending Inbox');
      expect(text.stdout).toContain('pack does not process inbox notes');

      await runCli(repo, ['update']);
      const historyAfter = await runCli(repo, ['history', 'History Routing']);
      expect(historyAfter.stdout).toContain('History Routing Smoke');
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

async function readJsonFromMarkdown(filePath: string): Promise<any> {
  const raw = await readFile(filePath, 'utf8');
  const match = raw.match(/```json\n([\s\S]*?)\n```/);
  if (!match) throw new Error(`Missing metadata JSON in ${filePath}`);
  return JSON.parse(match[1]);
}
