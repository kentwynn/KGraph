import { cp, readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { cleanupTempRepo, copyFixture, runCli, writeText } from '../fixtures/helpers.js';

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
      expect(markdown.stdout).toContain('KGraph Context · auth refresh');
      expect(markdown.stdout).toContain('● Signal');
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
      expect(result.stdout).toContain('Memory');
      expect(result.stdout).toContain('active atoms');
      expect(result.stdout).toContain('KGraph Context · auth refresh');
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
      expect(result.stdout).toContain('pending inbox');
      expect(result.stdout).toContain('Next');
      expect(result.stdout).toContain('kgraph "auth token refresh"');
      expect(result.stdout).toContain('kgraph --help');
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('enforces final capture through the root workflow', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      await gitInit(repo);
      await gitCommitAll(repo, 'initial');
      await runCli(repo, ['init']);
      await writeText(
        repo,
        'src/auth.ts',
        'export function loginUser() { return refreshSession(); }\nexport function refreshSession() { return "changed"; }\n',
      );

      const missing = await runCli(repo, ['auth refresh', '--final']);
      expect(missing.code).toBe(1);
      expect(missing.stdout).toContain('KGraph Final Check');
      expect(missing.stdout).toContain('capture-required');
      expect(missing.stdout).toContain('kgraph "auth refresh" --capture');

      const captured = await runCli(repo, [
        'auth refresh',
        '--capture',
        'Refresh session behavior changed in src/auth.ts.',
        '--capture-file',
        'src/auth.ts',
        '--capture-symbol',
        'refreshSession',
        '--capture-confidence',
        'high',
      ]);
      expect(captured.code).toBe(0);
      expect(captured.stdout).toContain('Stored summary cognition');

      const final = await runCli(repo, ['auth refresh', '--final']);
      expect(final.code).toBe(0);
      expect(final.stdout).toContain('status        captured');
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('detects non-git file-map changes during final capture checks', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      await runCli(repo, ['init']);
      await writeText(
        repo,
        'src/auth.ts',
        'export function loginUser() { return refreshSession(); }\nexport function refreshSession() { return "non-git-change"; }\n',
      );

      const missing = await runCli(repo, ['auth refresh', '--final']);
      expect(missing.code).toBe(1);
      expect(missing.stdout).toContain('capture-required');
      expect(missing.stdout).toContain('changed files 1');

      const captured = await runCli(repo, [
        'auth refresh',
        '--capture',
        'Non-git refresh behavior changed in src/auth.ts.',
        '--capture-file',
        'src/auth.ts',
        '--capture-symbol',
        'refreshSession',
        '--capture-confidence',
        'high',
      ]);
      expect(captured.code).toBe(0);

      const final = await runCli(repo, ['auth refresh', '--final']);
      expect(final.code).toBe(0);
      expect(final.stdout).toContain('status        clean');
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('detects non-git deleted files during final capture checks', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      await runCli(repo, ['init']);
      await writeText(repo, 'src/temporary.ts', 'export const temporary = true;\n');
      await runCli(repo, ['scan']);
      await rm(path.join(repo, 'src', 'temporary.ts'));

      const missing = await runCli(repo, ['temporary cleanup', '--final']);
      expect(missing.code).toBe(1);
      expect(missing.stdout).toContain('capture-required');
      expect(missing.stdout).toContain('changed files 1');
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('reports unresolved memory review during final checks', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      await runCli(repo, ['init']);
      await runCli(repo, [
        'conclude',
        'old auth behavior',
        '--confidence',
        'high',
        '--file',
        'src/auth.ts',
        '--symbol',
        'refreshSession',
        '--note',
        'Old refreshSession behavior depends on src/auth.ts.',
      ]);
      await runCli(repo, [
        'conclude',
        'old login behavior',
        '--confidence',
        'high',
        '--file',
        'src/auth.ts',
        '--symbol',
        'loginUser',
        '--note',
        'Old loginUser behavior depends on src/auth.ts.',
      ]);
      await writeText(
        repo,
        'src/auth.ts',
        'export function loginUser() { return refreshSession(); }\nexport function refreshSession() { return "new"; }\n',
      );
      await runCli(repo, [
        'new auth behavior',
        '--capture',
        'New refreshSession behavior is captured for src/auth.ts.',
        '--capture-file',
        'src/auth.ts',
        '--capture-symbol',
        'refreshSession',
        '--capture-confidence',
        'high',
      ]);

      const final = await runCli(repo, ['new auth behavior', '--final']);
      expect(final.code).toBe(1);
      expect(final.stdout).toContain('memory-review-required');
      expect(final.stdout).toContain('stale or needs-review atoms remain');
      expect(final.stdout).toContain('review atom');
      expect(final.stdout).toContain('review topic  needs-review: old auth behavior');
      expect(final.stdout).toContain('kgraph knowledge supersede');
      expect(final.stdout).toContain('review topic  needs-review: old login behavior');
      expect(final.stdout).toContain('inspect       kgraph knowledge get');
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('does not suggest unrelated supersede targets that only share weak topic words', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      await runCli(repo, ['init']);
      await writeText(
        repo,
        '.kgraph/inbox/history-smoke-check.md',
        `---
type: finding
confidence: medium
---
# History Smoke Check

## Summary
History smoke check is unrelated to calculator range memory.

## Key Files
- \`src/auth.ts\` - broad workflow evidence
`,
      );
      await runCli(repo, ['update']);
      await runCli(repo, [
        'conclude',
        'calculator range current smoke',
        '--confidence',
        'high',
        '--file',
        'src/auth.ts',
        '--symbol',
        'loginUser',
        '--note',
        'Calculator range memory is intentionally unrelated to the history smoke check.',
      ]);
      await writeText(
        repo,
        'src/auth.ts',
        'export function loginUser() { return "changed"; }\n',
      );

      const final = await runCli(repo, ['calculator range current smoke', '--final']);
      expect(final.code).toBe(1);
      expect(final.stdout).toContain(
        'review topic  needs-review: calculator range current smoke',
      );
      expect(final.stdout).toContain('inspect       kgraph knowledge get');
      expect(final.stdout).not.toContain('kgraph knowledge supersede');
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
      const duplicateQuality = await runCli(repo, ['doctor', '--quality']);
      expect(duplicateQuality.stdout).toContain('Duplicate atom topics: 1');
      expect(duplicateQuality.stdout).toContain('Duplicate compatibility note titles: 1');
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
