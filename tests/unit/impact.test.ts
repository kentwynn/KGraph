import { describe, expect, it } from 'vitest';
import { analyzeImpact } from '../../src/context/impact.js';
import type { CognitionNote } from '../../src/types/cognition.js';
import type { DependencyMap, FileMap, RelationshipMap, SymbolMap } from '../../src/types/maps.js';

describe('impact analysis', () => {
  it('returns imports, callers, calls, cognition, and risk for a matched symbol', () => {
    const buttonId = 'components/Button.tsx#function#Button#1#5';
    const pageId = 'app/blog/page.tsx#function#Blog#1#6';
    const fileMap: FileMap = {
      generatedAt: '',
      files: [
        { path: 'components/Button.tsx', language: 'typescript' } as never,
        { path: 'app/blog/page.tsx', language: 'typescript' } as never,
      ],
    };
    const symbolMap: SymbolMap = {
      generatedAt: '',
      symbols: [
        { id: buttonId, name: 'Button', kind: 'function', filePath: 'components/Button.tsx' } as never,
        { id: pageId, name: 'Blog', kind: 'function', filePath: 'app/blog/page.tsx' } as never,
      ],
    };
    const dependencyMap: DependencyMap = {
      generatedAt: '',
      dependencies: [
        {
          fromFile: 'app/blog/page.tsx',
          specifier: '@/components/Button',
          resolvedFile: 'components/Button.tsx',
          kind: 'local',
        },
      ],
    };
    const relationshipMap: RelationshipMap = {
      generatedAt: '',
      relationships: [
        {
          sourceType: 'symbol',
          sourceId: pageId,
          targetType: 'symbol',
          targetId: buttonId,
          relationshipType: 'calls',
          confidence: 'high',
        },
      ],
    };
    const cognition: CognitionNote[] = [
      {
        id: 'button-note',
        title: 'Button Styling',
        tags: [],
        sections: {},
        relatedFiles: ['components/Button.tsx'],
        relatedSymbols: ['Button'],
        referencesStatus: 'current',
        sourceInboxPath: '',
        processedPath: '',
        createdAt: '',
        warnings: [],
      },
    ];

    const impact = analyzeImpact(
      'Button',
      { fileMap, symbolMap, dependencyMap, relationshipMap },
      cognition,
    );

    expect(impact.symbols[0].item.name).toBe('Button');
    expect(impact.importedBy).toContain('app/blog/page.tsx');
    expect(impact.callers).toEqual(
      expect.arrayContaining([expect.objectContaining({ sourceId: pageId })]),
    );
    expect(impact.relatedCognition[0].title).toBe('Button Styling');
  });

  it('infers import users from unresolved matching specifiers', () => {
    const fileMap: FileMap = {
      generatedAt: '',
      files: [
        { path: 'components/Button.tsx', language: 'typescript' } as never,
        { path: 'app/blog/page.tsx', language: 'typescript' } as never,
      ],
    };
    const symbolMap: SymbolMap = {
      generatedAt: '',
      symbols: [
        { id: 'components/Button.tsx#function#Button#1#5', name: 'Button', kind: 'function', filePath: 'components/Button.tsx' } as never,
      ],
    };
    const dependencyMap: DependencyMap = {
      generatedAt: '',
      dependencies: [
        {
          fromFile: 'app/blog/page.tsx',
          specifier: '@/components/Button',
          kind: 'package',
        },
      ],
    };

    const impact = analyzeImpact(
      'Button',
      {
        fileMap,
        symbolMap,
        dependencyMap,
        relationshipMap: { generatedAt: '', relationships: [] },
      },
      [],
    );

    expect(impact.importedBy).toContain('app/blog/page.tsx');
  });
});
