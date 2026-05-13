import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/config/config.js';
import { scanRepository } from '../../src/scanner/repo-scanner.js';
import type { FileMap } from '../../src/types/maps.js';
import {
  cleanupTempRepo,
  createTempRepo,
  readJson,
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

describe('git-aware scan optimization', () => {
  it('stores scannedAtCommit in files.json after init in a git repo', async () => {
    const repo = await createTempRepo();
    try {
      await gitInit(repo);
      await writeText(
        repo,
        'src/index.ts',
        'export function hello() { return 1; }\n',
      );
      await gitCommitAll(repo, 'initial');

      await runCli(repo, ['init']);

      const fileMap = await readJson<FileMap>(repo, '.kgraph/map/files.json');
      expect(fileMap.scannedAtCommit).toMatch(/^[0-9a-f]{40}$/);
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('uses git-based skip on second scan, achieving higher skippedFiles count', async () => {
    const repo = await createTempRepo();
    try {
      await gitInit(repo);
      await writeText(repo, 'src/a.ts', 'export function a() { return 1; }\n');
      await writeText(repo, 'src/b.ts', 'export function b() { return 2; }\n');
      await gitCommitAll(repo, 'initial');

      const first = await scanRepository(repo, DEFAULT_CONFIG);
      expect(first.skippedFiles).toBe(0);

      // Record the commit from the first scan
      const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
        cwd: repo,
      });
      const commit = stdout.trim();

      // No code changes — second scan with stored commit should skip both files via git
      const second = await scanRepository(repo, DEFAULT_CONFIG, {
        ...first,
        scannedAtCommit: commit,
      });
      expect(second.files).toHaveLength(2);
      expect(second.skippedFiles).toBe(2);
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('re-scans only committed-changed files when scannedAtCommit is set', async () => {
    const repo = await createTempRepo();
    try {
      await gitInit(repo);
      await writeText(repo, 'src/a.ts', 'export function a() { return 1; }\n');
      await writeText(repo, 'src/b.ts', 'export function b() { return 2; }\n');
      await gitCommitAll(repo, 'initial');

      const first = await scanRepository(repo, DEFAULT_CONFIG);
      const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
        cwd: repo,
      });
      const firstCommit = stdout.trim();

      // Commit a change to b.ts only
      await writeFile(
        path.join(repo, 'src/b.ts'),
        'export function b() { return 99; }\n',
        'utf8',
      );
      await gitCommitAll(repo, 'update b');

      const second = await scanRepository(repo, DEFAULT_CONFIG, {
        ...first,
        scannedAtCommit: firstCommit,
      });

      expect(second.files).toHaveLength(2);
      // a.ts skipped via git, b.ts re-scanned
      expect(second.skippedFiles).toBe(1);
      const bSymbols = second.symbols.filter((s) => s.filePath === 'src/b.ts');
      expect(bSymbols.map((s) => s.name)).toContain('b');
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('falls back to mtime-based skip when not in a git repo', async () => {
    const repo = await createTempRepo();
    try {
      // No git init — plain directory
      await writeText(repo, 'src/a.ts', 'export function a() { return 1; }\n');
      const first = await scanRepository(repo, DEFAULT_CONFIG);
      expect(first.skippedFiles).toBe(0);

      // No changes — mtime+size fallback should skip on second scan
      const second = await scanRepository(repo, DEFAULT_CONFIG, first);
      expect(second.files).toHaveLength(1);
      expect(second.skippedFiles).toBe(1);
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});

describe('git changes in context output', () => {
  it('shows Recent Git Changes section in markdown output', async () => {
    const repo = await createTempRepo();
    try {
      await gitInit(repo);
      await writeText(
        repo,
        'src/auth.ts',
        'export function login() { return true; }\n',
      );
      await gitCommitAll(repo, 'initial');

      await runCli(repo, ['init']);

      // Make an unstaged change
      await writeFile(
        path.join(repo, 'src/auth.ts'),
        'export function login() { return false; }\n',
        'utf8',
      );

      const result = await runCli(repo, ['context', 'auth']);
      expect(result.stdout).toContain('● Recent Git Changes');
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('includes gitChanges in JSON context output', async () => {
    const repo = await createTempRepo();
    try {
      await gitInit(repo);
      await writeText(
        repo,
        'src/auth.ts',
        'export function login() { return true; }\n',
      );
      await gitCommitAll(repo, 'initial');

      await runCli(repo, ['init']);

      // Stage a change
      await writeFile(
        path.join(repo, 'src/auth.ts'),
        'export function login() { return false; }\n',
        'utf8',
      );
      await execFileAsync('git', ['add', 'src/auth.ts'], { cwd: repo });

      const result = await runCli(repo, ['context', 'auth', '--json']);
      const parsed = JSON.parse(result.stdout) as { gitChanges?: unknown[] };
      expect(parsed.gitChanges).toBeDefined();
      expect(Array.isArray(parsed.gitChanges)).toBe(true);
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('shows None when no git changes exist', async () => {
    const repo = await createTempRepo();
    try {
      // Not a git repo — no changes possible
      await writeText(
        repo,
        'src/auth.ts',
        'export function login() { return true; }\n',
      );
      await runCli(repo, ['init']);

      const result = await runCli(repo, ['context', 'auth']);
      expect(result.stdout).toContain('● Recent Git Changes');
      expect(result.stdout).toContain('- None');
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});
