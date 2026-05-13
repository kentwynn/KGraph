import { cp, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cleanupTempRepo, copyFixture, runCli } from '../fixtures/helpers.js';

describe('kgraph context', () => {
  it('returns markdown and json context', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      await runCli(repo, ['init']);
      await runCli(repo, ['scan']);
      await cp(
        path.join(
          process.cwd(),
          'tests/fixtures/cognition-notes/auth-debugging.md',
        ),
        path.join(repo, '.kgraph/inbox/auth-debugging.md'),
      );
      await runCli(repo, ['update']);
      const markdown = await runCli(repo, ['context', 'auth refresh']);
      expect(markdown.stdout).toContain('# KGraph Context');
      expect(markdown.stdout).toContain('because');
      const json = await runCli(repo, ['context', 'auth refresh', '--json']);
      const parsed = JSON.parse(json.stdout);
      expect(parsed.query).toBe('auth refresh');
      expect(parsed.relationshipExplanations).toBeDefined();
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('shows symbol line ranges and file metadata in context', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      await runCli(repo, ['init']);
      const markdown = await runCli(repo, ['context', 'auth']);
      expect(markdown.stdout).toContain('(function)');
      expect(markdown.stdout).toMatch(/src\/auth\.ts:\d+-\d+/);
      expect(markdown.stdout).toContain('[typescript');
      expect(markdown.stdout).toContain('tokens]');
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('shows grouped relationships in context', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      await runCli(repo, ['init']);
      const markdown = await runCli(repo, ['context', 'auth refresh']);
      expect(markdown.stdout).toContain('Imports:');
      expect(markdown.stdout).toContain('→');
      expect(markdown.stdout).toContain('connected to matched');
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('includes nearby symbols from 1-hop imports', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      await runCli(repo, ['init']);
      const markdown = await runCli(repo, ['context', 'loginUser']);
      expect(markdown.stdout).toContain('Nearby Symbols');
      expect(markdown.stdout).toContain('refreshSession');
      expect(markdown.stdout).toContain('1-hop import');
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('returns impact for matched symbols', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      await runCli(repo, ['init']);
      await runCli(repo, ['scan']);
      const result = await runCli(repo, ['impact', 'refreshSession']);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('# KGraph Impact');
      expect(result.stdout).toContain('refreshSession');
      expect(result.stdout).toContain('Called By');
      expect(result.stdout).toContain('loginUser');
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('runs the default refresh workflow with a topic', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      await runCli(repo, ['init']);
      const result = await runCli(repo, ['auth refresh']);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Refresh Complete');
      expect(result.stdout).toContain('# KGraph Context');
      expect(result.stdout).toContain('src/auth.ts');
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('runs the default refresh workflow without a topic and prints next actions', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      await runCli(repo, ['init']);
      const result = await runCli(repo, []);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('KGraph');
      expect(result.stdout).toContain('Refresh Complete');
      expect(result.stdout).toContain('files');
      expect(result.stdout).toContain('Next');
      expect(result.stdout).toContain('kgraph "auth token refresh"');
      expect(result.stdout).toContain('kgraph --help');
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('stores direct conclusions and compacts duplicate cognition', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      await runCli(repo, ['init']);
      await runCli(repo, ['scan']);
      const first = await runCli(repo, [
        'conclude',
        'auth refresh decision',
        '--type',
        'decision',
        '--confidence',
        'high',
        '--domain',
        'auth',
        '--file',
        'src/auth.ts',
        '--symbol',
        'refreshSession',
        '--note',
        'Refresh handling belongs in src/auth.ts.',
      ]);
      expect(first.code).toBe(0);
      expect(first.stdout).toContain('Stored decision cognition');
      await runCli(repo, [
        'conclude',
        'auth refresh decision',
        '--type',
        'decision',
        '--confidence',
        'medium',
        '--domain',
        'auth',
        '--file',
        'src/auth.ts',
        '--symbol',
        'refreshSession',
        '--note',
        'Refresh handling belongs in src/auth.ts.',
      ]);
      await runCli(repo, [
        'conclude',
        'auth refresh decision',
        '--type',
        'decision',
        '--confidence',
        'medium',
        '--domain',
        'auth',
        '--file',
        'src/auth.ts',
        '--note',
        'Token expiry handling is a separate finding under the same topic.',
      ]);

      const preview = await runCli(repo, ['compact', '--dry-run', '--json']);
      expect(JSON.parse(preview.stdout).merged).toHaveLength(1);
      const compact = await runCli(repo, ['compact']);
      expect(compact.stdout).toContain('Merged duplicate groups: 1');

      const context = await runCli(repo, ['context', 'auth refresh decision']);
      expect(context.stdout).toContain('auth refresh decision');
      expect(context.stdout).toContain('decision, high');
      const contextJson = JSON.parse(
        (await runCli(repo, ['context', 'auth refresh decision', '--json']))
          .stdout,
      );
      expect(
        contextJson.relevantCognition.map(
          (item: { item: { summary?: string } }) => item.item.summary,
        ),
      ).toContain(
        'Token expiry handling is a separate finding under the same topic.',
      );

      const domain = await readJsonFromMarkdown(
        path.join(repo, '.kgraph', 'domains', 'auth.md'),
      );
      expect(domain.cognitionNotes).toHaveLength(2);
      expect(domain.cognitionNotes).not.toContain(
        JSON.parse(preview.stdout).merged[0].sourceIds[0],
      );
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('prints root help for plain kgraph before initialization', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      const result = await runCli(repo, []);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('KGraph');
      expect(result.stdout).toContain('Usage');
      expect(result.stdout).toContain('init');
      expect(result.stderr).toBe('');
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('prints actionable init guidance before context is available', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      const result = await runCli(repo, ['context', 'auth']);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain(
        'KGraph is not initialized for this repository.',
      );
      expect(result.stderr).toContain('kgraph init --integrations');
      expect(result.stderr).toContain('kgraph doctor');
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});

async function readJsonFromMarkdown(filePath: string): Promise<any> {
  const raw = await readFile(filePath, 'utf8');
  const match = raw.match(/```json\n([\s\S]*?)\n```/);
  if (!match) throw new Error('Missing metadata JSON');
  return JSON.parse(match[1]);
}
