import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/config/config.js';
import { scanRepository } from '../../src/scanner/repo-scanner.js';
import {
  cleanupTempRepo,
  copyFixture,
  createTempRepo,
  writeText,
} from '../fixtures/helpers.js';

describe('repo scanner', () => {
  it('scans JS/TS files and generic metadata', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      const result = await scanRepository(repo, DEFAULT_CONFIG);
      expect(result.files.map((file) => file.path)).toContain('src/auth.ts');
      expect(result.files.map((file) => file.path)).toContain('README.md');
      expect(result.symbols.map((symbol) => symbol.name)).toEqual(
        expect.arrayContaining(['loginUser', 'AuthService']),
      );
      expect(result.dependencies).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ fromFile: 'src/auth.ts' }),
        ]),
      );
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('skips generated AI tool, planning, cache, and package artifacts by default', async () => {
    const repo = await createTempRepo();
    try {
      await writeText(
        repo,
        'src/app.ts',
        'export function app() { return true; }\n',
      );
      await writeText(repo, '.github/workflows/ci.yml', 'name: CI\n');
      await writeText(repo, '.npm-cache/blob', 'cache\n');
      await writeText(
        repo,
        '.agents/skills/kgraph/SKILL.md',
        'generated skill\n',
      );
      await writeText(
        repo,
        '.specify/templates/spec.md',
        'generated planning file\n',
      );
      await writeText(
        repo,
        'specs/001-kgraph/spec.md',
        'generated feature spec\n',
      );
      await writeText(repo, 'tmp/smoke/file.txt', 'temporary smoke output\n');
      await writeText(
        repo,
        '.github/copilot-instructions.md',
        'generated instructions\n',
      );
      await writeText(
        repo,
        '.github/prompts/kgraph.prompt.md',
        'generated prompt\n',
      );
      await writeText(
        repo,
        '.cursor/rules/kgraph.mdc',
        'generated cursor rule\n',
      );
      await writeText(
        repo,
        '.claude/commands/kgraph.md',
        'generated claude command\n',
      );
      await writeText(
        repo,
        '.windsurf/rules/kgraph.md',
        'generated windsurf rule\n',
      );
      await writeText(repo, '.clinerules/kgraph.md', 'generated cline rule\n');
      await writeText(repo, 'AGENTS.md', 'generated agent instructions\n');
      await writeText(repo, 'CLAUDE.md', 'generated claude instructions\n');
      await writeText(repo, 'GEMINI.md', 'generated gemini instructions\n');
      await writeText(repo, 'REQUIREMENTS.md', 'scratch requirements\n');
      await writeText(repo, 'kentwynn-kgraph-0.1.0.tgz', 'package tarball\n');

      const result = await scanRepository(repo, DEFAULT_CONFIG);
      const paths = result.files.map((file) => file.path);

      expect(paths).toContain('src/app.ts');
      expect(paths).toContain('.github/workflows/ci.yml');
      expect(paths).not.toEqual(
        expect.arrayContaining([
          '.npm-cache/blob',
          '.agents/skills/kgraph/SKILL.md',
          '.specify/templates/spec.md',
          'specs/001-kgraph/spec.md',
          'tmp/smoke/file.txt',
          '.github/copilot-instructions.md',
          '.github/prompts/kgraph.prompt.md',
          '.cursor/rules/kgraph.mdc',
          '.claude/commands/kgraph.md',
          '.windsurf/rules/kgraph.md',
          '.clinerules/kgraph.md',
          'AGENTS.md',
          'CLAUDE.md',
          'GEMINI.md',
          'REQUIREMENTS.md',
          'kentwynn-kgraph-0.1.0.tgz',
        ]),
      );
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('resolves extensionless local imports against discovered files', async () => {
    const repo = await createTempRepo();
    try {
      await writeText(
        repo,
        'src/app.ts',
        "import { view } from './view';\nview();\n",
      );
      await writeText(
        repo,
        'src/view.tsx',
        'export function view() { return null; }\n',
      );

      const result = await scanRepository(repo, DEFAULT_CONFIG);

      expect(result.dependencies).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fromFile: 'src/app.ts',
            specifier: './view',
            resolvedFile: 'src/view.tsx',
          }),
        ]),
      );
      expect(result.relationships).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourceId: 'src/app.ts',
            targetId: 'src/view.tsx',
            relationshipType: 'import',
            confidence: 'high',
          }),
        ]),
      );
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});

describe('incremental scan', () => {
  it('skips unchanged files on second scan', async () => {
    const repo = await createTempRepo();
    try {
      await writeText(
        repo,
        'src/index.ts',
        'export function hello() { return 1; }\n',
      );
      await writeText(
        repo,
        'src/utils.ts',
        'export function add(a: number, b: number) { return a + b; }\n',
      );

      const first = await scanRepository(repo, DEFAULT_CONFIG);
      expect(first.files).toHaveLength(2);
      expect(first.symbols.length).toBeGreaterThan(0);
      expect(first.skippedFiles).toBe(0);

      // Second scan with previous results — nothing changed
      const second = await scanRepository(repo, DEFAULT_CONFIG, first);
      expect(second.files).toHaveLength(2);
      expect(second.symbols).toEqual(first.symbols);
      expect(second.skippedFiles).toBe(2);
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('re-extracts only modified files', async () => {
    const repo = await createTempRepo();
    try {
      await writeText(
        repo,
        'src/index.ts',
        'export function hello() { return 1; }\n',
      );
      await writeText(
        repo,
        'src/utils.ts',
        'export function add(a: number, b: number) { return a + b; }\n',
      );

      const first = await scanRepository(repo, DEFAULT_CONFIG);

      // Modify one file (ensure mtime changes)
      await new Promise((resolve) => setTimeout(resolve, 50));
      await writeFile(
        path.join(repo, 'src/utils.ts'),
        'export function subtract(a: number, b: number) { return a - b; }\n',
        'utf8',
      );

      const second = await scanRepository(repo, DEFAULT_CONFIG, first);
      expect(second.files).toHaveLength(2);
      expect(second.skippedFiles).toBe(1); // index.ts skipped, utils.ts re-extracted

      const symbolNames = second.symbols.map((s) => s.name);
      expect(symbolNames).toContain('subtract');
      expect(symbolNames).not.toContain('add');
      expect(symbolNames).toContain('hello'); // carried forward
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('handles deleted files by not carrying them forward', async () => {
    const repo = await createTempRepo();
    try {
      await writeText(
        repo,
        'src/index.ts',
        'export function hello() { return 1; }\n',
      );
      await writeText(
        repo,
        'src/temp.ts',
        'export function temp() { return 0; }\n',
      );

      const first = await scanRepository(repo, DEFAULT_CONFIG);
      expect(first.files).toHaveLength(2);

      await rm(path.join(repo, 'src/temp.ts'));

      const second = await scanRepository(repo, DEFAULT_CONFIG, first);
      expect(second.files).toHaveLength(1);
      expect(second.files[0].path).toBe('src/index.ts');
      expect(second.symbols.map((s) => s.name)).not.toContain('temp');
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('extracts newly added files while skipping unchanged', async () => {
    const repo = await createTempRepo();
    try {
      await writeText(
        repo,
        'src/index.ts',
        'export function hello() { return 1; }\n',
      );

      const first = await scanRepository(repo, DEFAULT_CONFIG);
      expect(first.files).toHaveLength(1);

      await writeText(
        repo,
        'src/new.ts',
        'export function newFunc() { return 2; }\n',
      );

      const second = await scanRepository(repo, DEFAULT_CONFIG, first);
      expect(second.files).toHaveLength(2);
      expect(second.skippedFiles).toBe(1); // index.ts skipped
      expect(second.symbols.map((s) => s.name)).toContain('hello');
      expect(second.symbols.map((s) => s.name)).toContain('newFunc');
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});
