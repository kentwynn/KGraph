import { execFile, spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Returns true if the given directory is inside a git repository.
 * Uses a fast filesystem check rather than spawning a process.
 */
export async function isGitRepo(rootPath: string): Promise<boolean> {
  try {
    await access(path.join(rootPath, '.git'));
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns the current HEAD commit hash, or null if unavailable.
 */
export async function getCurrentCommit(
  rootPath: string,
): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
      cwd: rootPath,
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Returns paths of files changed between the given ref and HEAD.
 * Returns an empty array if git is unavailable or the ref is unknown.
 */
export async function getChangedFilesSince(
  rootPath: string,
  ref: string,
): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['diff', '--name-only', ref, 'HEAD'],
      { cwd: rootPath },
    );
    return stdout
      .trim()
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Returns the subset of paths ignored by Git, including nested .gitignore rules.
 * Falls back to an empty set when Git is unavailable or the directory is not a repo.
 */
export async function getGitIgnoredFiles(
  rootPath: string,
  paths: string[],
): Promise<Set<string>> {
  if (paths.length === 0) {
    return new Set();
  }

  return new Promise((resolve) => {
    const child = spawn('git', ['check-ignore', '--stdin'], {
      cwd: rootPath,
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    let stdout = '';

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.on('error', () => resolve(new Set()));
    child.on('close', (code) => {
      if (code !== 0 && code !== 1) {
        resolve(new Set());
        return;
      }
      resolve(
        new Set(
          stdout
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
        ),
      );
    });

    child.stdin.end(`${paths.join('\n')}\n`);
  });
}

/**
 * Returns paths of files with uncommitted changes (staged or unstaged)
 * relative to HEAD. Returns an empty array if git is unavailable.
 */
export async function getWorkingTreeChanges(
  rootPath: string,
): Promise<string[]> {
  try {
    const [stagedResult, unstagedResult] = await Promise.all([
      execFileAsync('git', ['diff', '--name-only', '--cached'], {
        cwd: rootPath,
      }),
      execFileAsync('git', ['diff', '--name-only'], { cwd: rootPath }),
    ]);
    const staged = stagedResult.stdout
      .trim()
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const unstaged = unstagedResult.stdout
      .trim()
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    // Deduplicate: a file can appear in both if partially staged
    return [...new Set([...staged, ...unstaged])];
  } catch {
    return [];
  }
}

export type WorkingTreeChange = {
  path: string;
  staged: boolean;
  unstaged: boolean;
};

/**
 * Returns working-tree changes with staged/unstaged flags.
 * Returns an empty array if git is unavailable.
 */
export async function getWorkingTreeChangesDetailed(
  rootPath: string,
): Promise<WorkingTreeChange[]> {
  try {
    const [stagedResult, unstagedResult] = await Promise.all([
      execFileAsync('git', ['diff', '--name-only', '--cached'], {
        cwd: rootPath,
      }),
      execFileAsync('git', ['diff', '--name-only'], { cwd: rootPath }),
    ]);
    const staged = new Set(
      stagedResult.stdout
        .trim()
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    );
    const unstaged = new Set(
      unstagedResult.stdout
        .trim()
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    );
    const all = new Set([...staged, ...unstaged]);
    return [...all].map((filePath) => ({
      path: filePath,
      staged: staged.has(filePath),
      unstaged: unstaged.has(filePath),
    }));
  } catch {
    return [];
  }
}

/**
 * Returns up to `limit` files changed in the most recent commits
 * (excluding uncommitted changes). Returns an empty array if git is unavailable.
 */
export async function getRecentlyCommittedFiles(
  rootPath: string,
  limit = 5,
): Promise<string[]> {
  try {
    // git log --name-only gives files touched in each of the last N commits
    const { stdout } = await execFileAsync(
      'git',
      ['log', '--name-only', '--pretty=format:', `-n`, String(limit), 'HEAD'],
      { cwd: rootPath },
    );
    return [
      ...new Set(
        stdout
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      ),
    ];
  } catch {
    return [];
  }
}
