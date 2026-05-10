import { describe, expect, it } from 'vitest';
import type { CognitionNote } from '../../src/types/cognition.js';
import type {
  DependencyMap,
  FileMap,
  RelationshipMap,
  RepositoryFile,
  SymbolMap,
} from '../../src/types/maps.js';
import { buildGraph } from '../../src/visualization/graph-builder.js';

function makeFile(id: string, path: string, language: string): RepositoryFile {
  return {
    id,
    path,
    extension: '.ts',
    language,
    sizeBytes: 512,
    contentHash: 'abc',
    scanStatus: 'mapped',
    warnings: [],
  };
}

const emptyMaps = {
  fileMap: { generatedAt: '', files: [] } as FileMap,
  symbolMap: { generatedAt: '', symbols: [] } as SymbolMap,
  depMap: { generatedAt: '', dependencies: [] } as DependencyMap,
  relMap: { generatedAt: '', relationships: [] } as RelationshipMap,
};

describe('graph-builder', () => {
  it('returns empty elements for empty maps', () => {
    const result = buildGraph(
      emptyMaps.fileMap,
      emptyMaps.symbolMap,
      emptyMaps.depMap,
      emptyMaps.relMap,
      [],
    );
    expect(result.elements).toHaveLength(0);
    expect(result.meta.fileCount).toBe(0);
    expect(result.meta.symbolCount).toBe(0);
    expect(result.meta.cognitionCount).toBe(0);
  });

  it('creates a file node for each file with correct color', () => {
    const fileMap: FileMap = {
      generatedAt: '',
      files: [makeFile('f1', 'src/auth.ts', 'typescript')],
    };
    const result = buildGraph(
      fileMap,
      emptyMaps.symbolMap,
      emptyMaps.depMap,
      emptyMaps.relMap,
      [],
    );
    expect(result.elements).toHaveLength(1);
    const node = result.elements[0];
    expect(node.data.id).toBe('f1');
    expect(node.data.type).toBe('file');
    expect(node.data.color).toBe('#3b82f6');
    expect(node.data.label).toBe('auth.ts');
    expect(node.classes).toContain('file');
  });

  it('uses fallback color for unknown language', () => {
    const fileMap: FileMap = {
      generatedAt: '',
      files: [makeFile('f1', 'src/main.rb', 'ruby')],
    };
    const result = buildGraph(
      fileMap,
      emptyMaps.symbolMap,
      emptyMaps.depMap,
      emptyMaps.relMap,
      [],
    );
    expect(result.elements[0].data.color).toBe('#94a3b8');
  });

  it('creates import edges only for local resolved deps', () => {
    const fileMap: FileMap = {
      generatedAt: '',
      files: [
        makeFile('f1', 'src/a.ts', 'typescript'),
        makeFile('f2', 'src/b.ts', 'typescript'),
      ],
    };
    const depMap: DependencyMap = {
      generatedAt: '',
      dependencies: [
        {
          fromFile: 'src/a.ts',
          specifier: './b',
          resolvedFile: 'src/b.ts',
          kind: 'local',
        },
        {
          fromFile: 'src/a.ts',
          specifier: 'react',
          resolvedFile: undefined,
          kind: 'package',
        },
      ],
    };
    const result = buildGraph(
      fileMap,
      emptyMaps.symbolMap,
      depMap,
      emptyMaps.relMap,
      [],
    );
    const edges = result.elements.filter((e) => e.data.source);
    expect(edges).toHaveLength(1);
    expect(edges[0].data.source).toBe('f1');
    expect(edges[0].data.target).toBe('f2');
    expect(edges[0].classes).toBe('import');
  });

  it('deduplicates import edges', () => {
    const fileMap: FileMap = {
      generatedAt: '',
      files: [
        makeFile('f1', 'src/a.ts', 'typescript'),
        makeFile('f2', 'src/b.ts', 'typescript'),
      ],
    };
    const depMap: DependencyMap = {
      generatedAt: '',
      dependencies: [
        {
          fromFile: 'src/a.ts',
          specifier: './b',
          resolvedFile: 'src/b.ts',
          kind: 'local',
        },
        {
          fromFile: 'src/a.ts',
          specifier: './b',
          resolvedFile: 'src/b.ts',
          kind: 'local',
        },
      ],
    };
    const result = buildGraph(
      fileMap,
      emptyMaps.symbolMap,
      depMap,
      emptyMaps.relMap,
      [],
    );
    const edges = result.elements.filter((e) => e.data.type === 'import');
    expect(edges).toHaveLength(1);
  });

  it('creates cognition nodes with ref edges to known files', () => {
    const fileMap: FileMap = {
      generatedAt: '',
      files: [makeFile('f1', 'src/auth.ts', 'typescript')],
    };
    const note: CognitionNote = {
      id: 'n1',
      title: 'Auth Notes',
      domain: 'auth',
      tags: [],
      sections: {},
      relatedFiles: ['src/auth.ts'],
      relatedSymbols: ['getSession'],
      referencesStatus: 'current',
      sourceInboxPath: '',
      processedPath: '',
      createdAt: '',
      warnings: [],
    };
    const result = buildGraph(
      fileMap,
      emptyMaps.symbolMap,
      emptyMaps.depMap,
      emptyMaps.relMap,
      [note],
    );
    const cogNode = result.elements.find((e) => e.data.id === 'cognition-n1');
    expect(cogNode).toBeDefined();
    expect(cogNode?.data.type).toBe('cognition');
    expect(cogNode?.data.color).toBe('#10b981');
    expect(cogNode?.classes).toContain('cognition');
    const refEdge = result.elements.find(
      (e) => e.data.type === 'cognition-ref',
    );
    expect(refEdge).toBeDefined();
    expect(refEdge?.data.target).toBe('f1');
  });

  it('skips cognition ref edges for files not in the file map', () => {
    const note: CognitionNote = {
      id: 'n1',
      title: 'Notes',
      domain: undefined,
      tags: [],
      sections: {},
      relatedFiles: ['src/deleted.ts'],
      relatedSymbols: [],
      referencesStatus: 'stale',
      sourceInboxPath: '',
      processedPath: '',
      createdAt: '',
      warnings: [],
    };
    const result = buildGraph(
      emptyMaps.fileMap,
      emptyMaps.symbolMap,
      emptyMaps.depMap,
      emptyMaps.relMap,
      [note],
    );
    const refEdges = result.elements.filter(
      (e) => e.data.type === 'cognition-ref',
    );
    expect(refEdges).toHaveLength(0);
  });

  it('reports correct meta counts', () => {
    const fileMap: FileMap = {
      generatedAt: '',
      files: [
        makeFile('f1', 'a.ts', 'typescript'),
        makeFile('f2', 'b.ts', 'typescript'),
      ],
    };
    const symbolMap: SymbolMap = {
      generatedAt: '',
      symbols: [
        {
          id: 's1',
          name: 'foo',
          kind: 'function',
          filePath: 'a.ts',
          exported: true,
        },
      ],
    };
    const note: CognitionNote = {
      id: 'n1',
      title: 'N',
      domain: undefined,
      tags: [],
      sections: {},
      relatedFiles: [],
      relatedSymbols: [],
      referencesStatus: 'current',
      sourceInboxPath: '',
      processedPath: '',
      createdAt: '',
      warnings: [],
    };
    const result = buildGraph(
      fileMap,
      symbolMap,
      emptyMaps.depMap,
      emptyMaps.relMap,
      [note],
    );
    expect(result.meta.fileCount).toBe(2);
    expect(result.meta.symbolCount).toBe(1);
    expect(result.meta.cognitionCount).toBe(1);
  });

  it('creates symbol nodes and relationship edges from the relationship map', () => {
    const fileMap: FileMap = {
      generatedAt: '',
      files: [makeFile('a.ts', 'a.ts', 'typescript')],
    };
    const symbolMap: SymbolMap = {
      generatedAt: '',
      symbols: [
        {
          id: 'a.ts#function#run#1#1',
          name: 'run',
          kind: 'function',
          filePath: 'a.ts',
          exported: true,
        },
      ],
    };
    const relMap: RelationshipMap = {
      generatedAt: '',
      relationships: [
        {
          sourceType: 'file',
          sourceId: 'a.ts',
          targetType: 'symbol',
          targetId: 'a.ts#function#run#1#1',
          relationshipType: 'contains',
          confidence: 'high',
        },
      ],
    };

    const result = buildGraph(
      fileMap,
      symbolMap,
      emptyMaps.depMap,
      relMap,
      [],
    );

    expect(result.elements.find((e) => e.data.type === 'symbol')).toBeDefined();
    expect(
      result.elements.find((e) => e.data.type === 'contains'),
    ).toBeDefined();
  });
});
