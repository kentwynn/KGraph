import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/config/config.js';
import { queryContext } from '../../src/context/context-query.js';
import { buildContextPack } from '../../src/context/context-pack.js';
import { createKnowledgeAtom } from '../../src/knowledge/atom-store.js';
import { ensureWorkspace } from '../../src/storage/kgraph-paths.js';
import { cleanupTempRepo, createTempRepo, writeText } from '../fixtures/helpers.js';

describe('context query', () => {
  it('returns ranked files and symbols', async () => {
    const repo = await createTempRepo();
    try {
      const workspace = await ensureWorkspace(repo);
      const result = await queryContext(
        workspace,
        DEFAULT_CONFIG,
        {
          fileMap: {
            generatedAt: '',
            files: [{ path: 'src/auth.ts', language: 'typescript' } as never],
          },
          symbolMap: {
            generatedAt: '',
            symbols: [{ name: 'loginUser', filePath: 'src/auth.ts' } as never],
          },
          dependencyMap: { generatedAt: '', dependencies: [] },
          relationshipMap: { generatedAt: '', relationships: [] },
        },
        'auth login',
      );
      expect(result.relevantFiles).toHaveLength(1);
      expect(result.relevantSymbols).toHaveLength(1);
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('returns nearby ownership and call relationships for matched symbols', async () => {
    const repo = await createTempRepo();
    try {
      const workspace = await ensureWorkspace(repo);
      const classId = 'src/auth.ts#class#AuthService#1#5';
      const methodId = 'src/auth.ts#method#AuthService#refresh#2#4';
      const helperId = 'src/auth.ts#function#refreshSession#7#9';
      const result = await queryContext(
        workspace,
        DEFAULT_CONFIG,
        {
          fileMap: {
            generatedAt: '',
            files: [{ path: 'src/auth.ts', language: 'typescript' } as never],
          },
          symbolMap: {
            generatedAt: '',
            symbols: [
              {
                id: classId,
                name: 'AuthService',
                filePath: 'src/auth.ts',
                kind: 'class',
              } as never,
              {
                id: methodId,
                name: 'refresh',
                filePath: 'src/auth.ts',
                kind: 'method',
                parentName: 'AuthService',
              } as never,
              {
                id: helperId,
                name: 'refreshSession',
                filePath: 'src/auth.ts',
                kind: 'function',
              } as never,
            ],
          },
          dependencyMap: { generatedAt: '', dependencies: [] },
          relationshipMap: {
            generatedAt: '',
            relationships: [
              {
                sourceType: 'symbol',
                sourceId: classId,
                targetType: 'symbol',
                targetId: methodId,
                relationshipType: 'symbol-contains',
                confidence: 'high',
              },
              {
                sourceType: 'symbol',
                sourceId: methodId,
                targetType: 'symbol',
                targetId: helperId,
                relationshipType: 'calls',
                confidence: 'high',
              },
            ],
          },
        },
        'AuthService',
      );

      expect(result.relationships).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ relationshipType: 'symbol-contains' }),
          expect.objectContaining({ relationshipType: 'calls' }),
        ]),
      );
      expect(
        result.relationshipExplanations?.flatMap((item) => item.reasons),
      ).toEqual(expect.arrayContaining([
        expect.stringContaining('connected to matched symbol AuthService'),
      ]));
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('returns nearby symbols from 1-hop imported files', async () => {
    const repo = await createTempRepo();
    try {
      const workspace = await ensureWorkspace(repo);
      const result = await queryContext(
        workspace,
        DEFAULT_CONFIG,
        {
          fileMap: {
            generatedAt: '',
            files: [
              { path: 'src/auth.ts', language: 'typescript' } as never,
              { path: 'src/session.ts', language: 'typescript' } as never,
            ],
          },
          symbolMap: {
            generatedAt: '',
            symbols: [
              {
                id: 'src/auth.ts#function#loginUser#1#3',
                name: 'loginUser',
                kind: 'function',
                filePath: 'src/auth.ts',
                startLine: 1,
                endLine: 3,
                exported: true,
              } as never,
              {
                id: 'src/session.ts#function#refreshSession#1#3',
                name: 'refreshSession',
                kind: 'function',
                filePath: 'src/session.ts',
                startLine: 1,
                endLine: 3,
                exported: true,
              } as never,
            ],
          },
          dependencyMap: {
            generatedAt: '',
            dependencies: [
              {
                fromFile: 'src/auth.ts',
                specifier: './session',
                resolvedFile: 'src/session.ts',
                kind: 'local',
              },
            ],
          },
          relationshipMap: { generatedAt: '', relationships: [] },
        },
        'loginUser',
      );

      expect(result.nearbySymbols).toBeDefined();
      expect(result.nearbySymbols!.map((s) => s.name)).toContain(
        'refreshSession',
      );
      expect(result.nearbySymbolExplanations?.[0]?.reasons).toEqual(
        expect.arrayContaining([
          expect.stringContaining('exported symbol from 1-hop import'),
        ]),
      );
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('boosts files referenced by matching atoms over generic path matches', async () => {
    const repo = await createTempRepo();
    try {
      const workspace = await ensureWorkspace(repo);
      const maps = {
        fileMap: {
          generatedAt: '',
          files: [
            {
              path: 'openquery/app/workflow/page.tsx',
              language: 'typescriptreact',
              tokenEstimate: 1900,
            } as never,
            {
              path: 'www/app/(pages)/about/page.tsx',
              language: 'typescriptreact',
              tokenEstimate: 8800,
              contentHash: 'about-hash',
            } as never,
          ],
        },
        symbolMap: { generatedAt: '', symbols: [] },
        dependencyMap: { generatedAt: '', dependencies: [] },
        relationshipMap: { generatedAt: '', relationships: [] },
      };
      await createKnowledgeAtom(
        workspace,
        {
          type: 'decision',
          topic: 'resume page LSEG promotion Senior Lead AI Engineer July 2026',
          claim: 'About page LSEG work experience changed.',
          summary: 'About page LSEG work experience changed.',
          confidence: 'high',
          files: ['www/app/(pages)/about/page.tsx'],
          sourceCommand: 'conclude',
        },
        maps,
      );

      const result = await queryContext(
        workspace,
        DEFAULT_CONFIG,
        maps,
        'about page LSEG work experience',
      );

      expect(result.relevantFiles[0].item.path).toBe(
        'www/app/(pages)/about/page.tsx',
      );
      expect(result.relevantFiles[0].reasons).toEqual(
        expect.arrayContaining([
          expect.stringContaining('referenced by matched atom'),
        ]),
      );
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('packs cheap matching atoms before large generic files', async () => {
    const pack = buildContextPack(
      {
        query: 'about page LSEG work experience',
        matchedDomains: [],
        relevantFiles: [
          {
            item: {
              path: 'openquery/app/workflow/page.tsx',
              tokenEstimate: 1900,
            },
            score: 5,
            reasons: ['generic path-only match penalty'],
          },
          {
            item: {
              path: 'www/app/(pages)/about/page.tsx',
              tokenEstimate: 8800,
            },
            score: 20,
            reasons: ['referenced by matched atom "about"'],
          },
        ] as never,
        relevantSymbols: [],
        relevantCognition: [
          {
            item: {
              id: 'atom-1',
              title: 'resume page LSEG promotion Senior Lead AI Engineer July 2026',
              summary: 'About page LSEG work experience changed.',
            },
            score: 20,
            reasons: ['high confidence atom', 'active atom evidence'],
          },
        ] as never,
        relationships: [],
        relationshipExplanations: [],
        nearbySymbols: [],
        nearbySymbolExplanations: [],
        gitChanges: [
          {
            path: 'www/app/(pages)/about/page.tsx',
            status: 'unstaged',
            reason: 'unstaged change',
          },
        ],
        staleReferences: [],
        warnings: [],
      },
      2000,
    );

    expect(pack.items.map((item) => item.kind)).toEqual([
      'atom',
      'git-change',
      'file',
    ]);
    expect(pack.items[0].id).toBe('atom-1');
    expect(pack.omitted.map((item) => item.id)).toContain(
      'www/app/(pages)/about/page.tsx',
    );
  });

  it('packs relevant ranges from oversized files', async () => {
    const repo = await createTempRepo();
    try {
      const filler = Array.from({ length: 240 }, (_, index) =>
        `const filler${index} = "unrelated implementation detail";`,
      ).join('\n');
      await writeText(
        repo,
        'www/app/(pages)/about/page.tsx',
        [
          'const EXPERIENCE = [',
          '  {',
          '    title: "Senior Lead AI Engineer",',
          '    company: "LSEG",',
          '    period: "Jul 2026 - Present",',
          '    description: "Agent Adapter and Java Spring Boot work.",',
          '  },',
          '];',
          filler,
        ].join('\n'),
      );

      const pack = buildContextPack(
        {
          query: 'about page LSEG work experience',
          matchedDomains: [],
          relevantFiles: [
            {
              item: {
                path: 'www/app/(pages)/about/page.tsx',
                tokenEstimate: 8800,
              },
              score: 20,
              reasons: ['referenced by matched atom "about"'],
            },
          ] as never,
          relevantSymbols: [],
          relevantCognition: [
            {
              item: {
                id: 'atom-1',
                title: 'resume page LSEG promotion Senior Lead AI Engineer July 2026',
                summary: 'About page LSEG work experience changed.',
              },
              score: 20,
              reasons: ['high confidence atom', 'active atom evidence'],
            },
          ] as never,
          relationships: [],
          relationshipExplanations: [],
          nearbySymbols: [],
          nearbySymbolExplanations: [],
          gitChanges: [],
          staleReferences: [],
          warnings: [],
        },
        1600,
        repo,
      );

      const range = pack.items.find((item) => item.kind === 'file-range');
      expect(range?.id).toMatch(/^www\/app\/\(pages\)\/about\/page\.tsx:\d+-\d+$/);
      expect(range?.data).toMatchObject({
        path: 'www/app/(pages)/about/page.tsx',
      });
      expect(JSON.stringify(range?.data)).toContain('Senior Lead AI Engineer');
      expect(pack.omitted.map((item) => item.id)).toContain(
        'www/app/(pages)/about/page.tsx',
      );
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});
