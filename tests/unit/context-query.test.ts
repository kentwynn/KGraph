import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/config/config.js';
import { queryContext } from '../../src/context/context-query.js';
import { ensureWorkspace } from '../../src/storage/kgraph-paths.js';
import { cleanupTempRepo, createTempRepo } from '../fixtures/helpers.js';

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
});
