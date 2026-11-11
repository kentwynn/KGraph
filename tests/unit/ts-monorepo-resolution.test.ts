import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/config/config.js';
import { queryContext } from '../../src/context/context-query.js';
import { analyzeImpact } from '../../src/context/impact.js';
import { readTsPathAliases, scanRepository } from '../../src/scanner/repo-scanner.js';
import { ensureWorkspace } from '../../src/storage/kgraph-paths.js';
import { cleanupTempRepo, createTempRepo, writeText } from '../fixtures/helpers.js';

// Mirrors an Nx monorepo: shared code imported through a tsconfig alias and a barrel index.
async function writeMonorepo(repo: string): Promise<void> {
  await writeText(
    repo,
    'tsconfig.base.json',
    `{
      // comments are allowed in tsconfig files
      "compilerOptions": {
        "paths": {
          "@acme/common": ["libs/common/src/index.ts"],
          "@acme/elf/*": ["libs/elf/src/lib/*"]
        }
      }
    }\n`,
  );
  await writeText(repo, 'libs/common/src/index.ts', "export * from './lib/auth';\nexport * from './lib/models';\n");
  await writeText(repo, 'libs/common/src/lib/auth/index.ts', "export * from './auth.service';\n");
  await writeText(
    repo,
    'libs/common/src/lib/auth/auth.service.ts',
    "import { User } from '../models/user.model';\n" +
      'export class AuthService {\n  static consumeReturnUrl(): string | null {\n    return null;\n  }\n}\n',
  );
  await writeText(repo, 'libs/common/src/lib/models/index.ts', "export * from './user.model';\n");
  await writeText(repo, 'libs/common/src/lib/models/user.model.ts', 'export interface User { id: string }\n');
  await writeText(repo, 'libs/elf/src/lib/grid/grid.tsx', 'export function Grid() { return null; }\n');
  // Shares the word "url" with consumeReturnUrl; impact of the exact symbol must not include it.
  await writeText(repo, 'libs/elf/src/lib/url/source-url.tsx', 'export function SourceUrl() { return null; }\n');
  await writeText(repo, 'apps/landing/src/Links.tsx', "import { SourceUrl } from '@acme/elf/url/source-url';\nexport function Links() { return SourceUrl(); }\n");
  await writeText(
    repo,
    'apps/landing/src/App.tsx',
    "import { AuthService } from '@acme/common';\nimport { Grid } from '@acme/elf/grid/grid';\n" +
      'export function App() {\n  const url = AuthService.consumeReturnUrl();\n  return Grid();\n}\n',
  );
  await writeText(repo, 'apps/landing/src/Other.tsx', "import { User } from '@acme/common';\nexport function Other() {}\n");
}

describe('TypeScript monorepo resolution', () => {
  it('reads tsconfig path aliases, longest prefix first', async () => {
    const repo = await createTempRepo();
    try {
      await writeMonorepo(repo);
      const aliases = await readTsPathAliases(repo);
      expect(aliases.map((alias) => alias.prefix)).toEqual(['@acme/common', '@acme/elf/']);
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('resolves aliases, dotted file names and re-exports', async () => {
    const repo = await createTempRepo();
    try {
      await writeMonorepo(repo);
      const scan = await scanRepository(repo, DEFAULT_CONFIG);
      const resolved = (from: string, specifier: string) =>
        scan.dependencies.find((dep) => dep.fromFile === from && dep.specifier === specifier)?.resolvedFile;

      expect(resolved('apps/landing/src/App.tsx', '@acme/common')).toBe('libs/common/src/index.ts');
      expect(resolved('apps/landing/src/App.tsx', '@acme/elf/grid/grid')).toBe('libs/elf/src/lib/grid/grid.tsx');
      expect(resolved('libs/common/src/lib/auth/auth.service.ts', '../models/user.model')).toBe(
        'libs/common/src/lib/models/user.model.ts',
      );
      const reexport = scan.dependencies.find(
        (dep) => dep.fromFile === 'libs/common/src/lib/auth/index.ts' && dep.reexport,
      );
      expect(reexport?.resolvedFile).toBe('libs/common/src/lib/auth/auth.service.ts');
      expect(scan.dependencies.filter((dep) => dep.kind === 'local' && !dep.resolvedFile)).toEqual([]);
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('finds a static method caller that imports through a barrel, and not other barrel users', async () => {
    const repo = await createTempRepo();
    try {
      await writeMonorepo(repo);
      const scan = await scanRepository(repo, DEFAULT_CONFIG);
      const impact = analyzeImpact(
        'consumeReturnUrl',
        {
          fileMap: { generatedAt: '', files: scan.files },
          symbolMap: { generatedAt: '', symbols: scan.symbols },
          dependencyMap: { generatedAt: '', dependencies: scan.dependencies },
          relationshipMap: { generatedAt: '', relationships: scan.relationships },
        },
        [],
      );

      expect(impact.callers.map((rel) => rel.sourceId.split('#')[0])).toContain('apps/landing/src/App.tsx');
      expect(impact.importedBy).toContain('apps/landing/src/App.tsx');
      expect(impact.importedBy).not.toContain('apps/landing/src/Other.tsx');
      expect(impact.importedBy).not.toContain('apps/landing/src/Links.tsx');
      expect(impact.symbols.map((symbol) => symbol.item.name)).toEqual(['consumeReturnUrl']);
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('does not pull every importer of a barrel into the context', async () => {
    const repo = await createTempRepo();
    try {
      await writeMonorepo(repo);
      for (let index = 0; index < 60; index++) {
        await writeText(
          repo,
          `apps/feature${index}/src/page.tsx`,
          `import { User } from '@acme/common';\nexport function Page${index}() { return null; }\n`,
        );
      }
      const scan = await scanRepository(repo, DEFAULT_CONFIG);
      const workspace = await ensureWorkspace(repo);
      const result = await queryContext(
        workspace,
        DEFAULT_CONFIG,
        {
          fileMap: { generatedAt: '', files: scan.files },
          symbolMap: { generatedAt: '', symbols: scan.symbols },
          dependencyMap: { generatedAt: '', dependencies: scan.dependencies },
          relationshipMap: { generatedAt: '', relationships: scan.relationships },
        },
        'consumeReturnUrl',
      );
      const touched = new Set(
        result.relationships.flatMap((rel) => [rel.sourceId.split('#')[0], rel.targetId.split('#')[0]]),
      );
      expect([...touched].filter((file) => file.startsWith('apps/feature'))).toEqual([]);
      expect(result.relevantFiles[0]?.item.path).toBe('libs/common/src/lib/auth/auth.service.ts');
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});
