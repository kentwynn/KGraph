import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import {
  getChangedFilesSince,
  getCurrentCommit,
  getRecentlyCommittedFiles,
  getWorkingTreeChanges,
  getWorkingTreeChangesDetailed,
  isGitRepo,
} from '../../src/scanner/git-utils.js';
import { cleanupTempRepo, createTempRepo } from '../fixtures/helpers.js';

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

async function writeRepoFile(
  repoPath: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const fullPath = path.join(repoPath, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, 'utf8');
}

describe('isGitRepo', () => {
  it('returns true for a directory with a .git folder', async () => {
    const repo = await createTempRepo();
    try {
      await gitInit(repo);
      expect(await isGitRepo(repo)).toBe(true);
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('returns false for a plain directory without .git', async () => {
    const repo = await createTempRepo();
    try {
      expect(await isGitRepo(repo)).toBe(false);
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});

describe('getCurrentCommit', () => {
  it('returns null for a non-git directory', async () => {
    const repo = await createTempRepo();
    try {
      expect(await getCurrentCommit(repo)).toBeNull();
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('returns null for a git repo with no commits', async () => {
    const repo = await createTempRepo();
    try {
      await gitInit(repo);
      expect(await getCurrentCommit(repo)).toBeNull();
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('returns the HEAD commit hash after a commit', async () => {
    const repo = await createTempRepo();
    try {
      await gitInit(repo);
      await writeRepoFile(repo, 'a.ts', 'export const a = 1;\n');
      await gitCommitAll(repo, 'initial');
      const commit = await getCurrentCommit(repo);
      expect(commit).toMatch(/^[0-9a-f]{40}$/);
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});

describe('getChangedFilesSince', () => {
  it('returns empty array for a non-git directory', async () => {
    const repo = await createTempRepo();
    try {
      expect(await getChangedFilesSince(repo, 'HEAD~1')).toEqual([]);
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('returns empty array when ref is unknown', async () => {
    const repo = await createTempRepo();
    try {
      await gitInit(repo);
      await writeRepoFile(repo, 'a.ts', 'export const a = 1;\n');
      await gitCommitAll(repo, 'initial');
      expect(await getChangedFilesSince(repo, 'nonexistent-sha')).toEqual([]);
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('returns files changed between two commits', async () => {
    const repo = await createTempRepo();
    try {
      await gitInit(repo);
      await writeRepoFile(repo, 'a.ts', 'export const a = 1;\n');
      await gitCommitAll(repo, 'initial');
      const firstCommit = (await getCurrentCommit(repo))!;

      await writeRepoFile(repo, 'b.ts', 'export const b = 2;\n');
      await gitCommitAll(repo, 'add b');

      const changed = await getChangedFilesSince(repo, firstCommit);
      expect(changed).toContain('b.ts');
      expect(changed).not.toContain('a.ts');
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});

describe('getWorkingTreeChanges', () => {
  it('returns empty array for a non-git directory', async () => {
    const repo = await createTempRepo();
    try {
      expect(await getWorkingTreeChanges(repo)).toEqual([]);
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('returns unstaged modified files', async () => {
    const repo = await createTempRepo();
    try {
      await gitInit(repo);
      await writeRepoFile(repo, 'a.ts', 'export const a = 1;\n');
      await gitCommitAll(repo, 'initial');

      await writeRepoFile(repo, 'a.ts', 'export const a = 2;\n');
      const changes = await getWorkingTreeChanges(repo);
      expect(changes).toContain('a.ts');
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('returns staged files', async () => {
    const repo = await createTempRepo();
    try {
      await gitInit(repo);
      await writeRepoFile(repo, 'a.ts', 'export const a = 1;\n');
      await gitCommitAll(repo, 'initial');

      await writeRepoFile(repo, 'b.ts', 'export const b = 2;\n');
      await execFileAsync('git', ['add', 'b.ts'], { cwd: repo });
      const changes = await getWorkingTreeChanges(repo);
      expect(changes).toContain('b.ts');
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('deduplicates files that are both staged and unstaged', async () => {
    const repo = await createTempRepo();
    try {
      await gitInit(repo);
      await writeRepoFile(repo, 'a.ts', 'export const a = 1;\n');
      await gitCommitAll(repo, 'initial');

      // Stage a change then make another unstaged change to the same file
      await writeRepoFile(repo, 'a.ts', 'export const a = 2;\n');
      await execFileAsync('git', ['add', 'a.ts'], { cwd: repo });
      await writeRepoFile(repo, 'a.ts', 'export const a = 3;\n');

      const changes = await getWorkingTreeChanges(repo);
      expect(changes.filter((p) => p === 'a.ts')).toHaveLength(1);
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});

describe('getWorkingTreeChangesDetailed', () => {
  it('correctly marks staged vs unstaged flags', async () => {
    const repo = await createTempRepo();
    try {
      await gitInit(repo);
      await writeRepoFile(repo, 'a.ts', 'export const a = 1;\n');
      await writeRepoFile(repo, 'b.ts', 'export const b = 1;\n');
      await gitCommitAll(repo, 'initial');

      // Stage a change to a.ts, unstaged change to b.ts
      await writeRepoFile(repo, 'a.ts', 'export const a = 2;\n');
      await execFileAsync('git', ['add', 'a.ts'], { cwd: repo });
      await writeRepoFile(repo, 'b.ts', 'export const b = 2;\n');

      const changes = await getWorkingTreeChangesDetailed(repo);
      const aChange = changes.find((c) => c.path === 'a.ts');
      const bChange = changes.find((c) => c.path === 'b.ts');
      expect(aChange).toBeDefined();
      expect(aChange!.staged).toBe(true);
      expect(aChange!.unstaged).toBe(false);
      expect(bChange).toBeDefined();
      expect(bChange!.staged).toBe(false);
      expect(bChange!.unstaged).toBe(true);
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});

describe('getRecentlyCommittedFiles', () => {
  it('returns empty array for a non-git directory', async () => {
    const repo = await createTempRepo();
    try {
      expect(await getRecentlyCommittedFiles(repo)).toEqual([]);
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('returns files from recent commits', async () => {
    const repo = await createTempRepo();
    try {
      await gitInit(repo);
      await writeRepoFile(repo, 'a.ts', 'export const a = 1;\n');
      await gitCommitAll(repo, 'initial');
      await writeRepoFile(repo, 'b.ts', 'export const b = 2;\n');
      await gitCommitAll(repo, 'add b');

      const files = await getRecentlyCommittedFiles(repo, 5);
      expect(files).toContain('a.ts');
      expect(files).toContain('b.ts');
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('handles repos with fewer commits than the limit gracefully', async () => {
    const repo = await createTempRepo();
    try {
      await gitInit(repo);
      await writeRepoFile(repo, 'a.ts', 'export const a = 1;\n');
      await gitCommitAll(repo, 'only commit');

      // limit=5 but only 1 commit exists — should not throw
      const files = await getRecentlyCommittedFiles(repo, 5);
      expect(files).toContain('a.ts');
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});
