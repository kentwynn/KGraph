import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  countScopeFiles,
  detectWorkspaces,
  workspacesToDomainHints,
} from '../../src/cli/workspace-detection.js';
import { DEFAULT_CONFIG } from '../../src/config/config.js';

describe('workspace-detection', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'kgraph-ws-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('detectWorkspaces', () => {
    it('returns null for simple projects', async () => {
      await writeFile(path.join(tmpDir, 'package.json'), '{"name":"simple"}');
      const result = await detectWorkspaces(tmpDir);
      expect(result).toBeNull();
    });

    it('detects pnpm workspace', async () => {
      await writeFile(
        path.join(tmpDir, 'pnpm-workspace.yaml'),
        'packages:\n  - "packages/*"\n',
      );
      await mkdir(path.join(tmpDir, 'packages', 'core'), { recursive: true });
      await mkdir(path.join(tmpDir, 'packages', 'cli'), { recursive: true });

      const result = await detectWorkspaces(tmpDir);
      expect(result).not.toBeNull();
      expect(result!.tool).toBe('pnpm');
      expect(result!.packages).toHaveLength(2);
      expect(result!.packages.map((p) => p.name).sort()).toEqual([
        'cli',
        'core',
      ]);
    });

    it('detects npm workspaces from package.json', async () => {
      await writeFile(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({ name: 'root', workspaces: ['packages/*'] }),
      );
      await mkdir(path.join(tmpDir, 'packages', 'api'), { recursive: true });
      await mkdir(path.join(tmpDir, 'packages', 'web'), { recursive: true });

      const result = await detectWorkspaces(tmpDir);
      expect(result).not.toBeNull();
      expect(result!.tool).toBe('npm');
      expect(result!.packages).toHaveLength(2);
    });

    it('detects lerna packages', async () => {
      await writeFile(
        path.join(tmpDir, 'lerna.json'),
        JSON.stringify({ packages: ['modules/*'] }),
      );
      await mkdir(path.join(tmpDir, 'modules', 'auth'), { recursive: true });
      await mkdir(path.join(tmpDir, 'modules', 'db'), { recursive: true });

      const result = await detectWorkspaces(tmpDir);
      expect(result).not.toBeNull();
      expect(result!.tool).toBe('lerna');
      expect(result!.packages).toHaveLength(2);
    });

    it('detects rush projects', async () => {
      await writeFile(
        path.join(tmpDir, 'rush.json'),
        JSON.stringify({
          projects: [
            { packageName: '@scope/core', projectFolder: 'apps/core' },
            { packageName: '@scope/web', projectFolder: 'apps/web' },
          ],
        }),
      );

      const result = await detectWorkspaces(tmpDir);
      expect(result).not.toBeNull();
      expect(result!.tool).toBe('rush');
      expect(result!.packages).toEqual([
        { name: '@scope/core', path: 'apps/core' },
        { name: '@scope/web', path: 'apps/web' },
      ]);
    });

    it('ignores single-package npm workspaces', async () => {
      await writeFile(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({ name: 'root', workspaces: ['packages/*'] }),
      );
      // Only one directory — not a real monorepo
      await mkdir(path.join(tmpDir, 'packages', 'only'), { recursive: true });

      const result = await detectWorkspaces(tmpDir);
      expect(result).toBeNull();
    });
  });

  describe('workspacesToDomainHints', () => {
    it('converts packages to domain hints', () => {
      const hints = workspacesToDomainHints({
        tool: 'pnpm',
        packages: [
          { name: 'core', path: 'packages/core' },
          { name: 'cli', path: 'packages/cli' },
        ],
      });
      expect(hints).toEqual({
        core: { paths: ['packages/core/**'] },
        cli: { paths: ['packages/cli/**'] },
      });
    });
  });

  describe('countScopeFiles', () => {
    it('counts files matching include/exclude', async () => {
      await mkdir(path.join(tmpDir, 'src'), { recursive: true });
      await writeFile(path.join(tmpDir, 'src', 'a.ts'), '');
      await writeFile(path.join(tmpDir, 'src', 'b.ts'), '');
      await writeFile(path.join(tmpDir, 'readme.md'), '');

      const count = await countScopeFiles(tmpDir, DEFAULT_CONFIG);
      expect(count).toBe(3);
    });

    it('respects excludes', async () => {
      await mkdir(path.join(tmpDir, 'src'), { recursive: true });
      await mkdir(path.join(tmpDir, 'node_modules', 'dep'), {
        recursive: true,
      });
      await writeFile(path.join(tmpDir, 'src', 'a.ts'), '');
      await writeFile(path.join(tmpDir, 'node_modules', 'dep', 'index.js'), '');

      const count = await countScopeFiles(tmpDir, DEFAULT_CONFIG);
      expect(count).toBe(1);
    });
  });
});
