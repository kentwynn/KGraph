import { describe, expect, it } from 'vitest';
import type { KnowledgeAtom } from '../../src/types/knowledge.js';
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

function makeAtom(
  id: string,
  topic: string,
  files: string[],
  status: KnowledgeAtom['status'] = 'active',
): KnowledgeAtom {
  return {
    id,
    topic,
    type: 'summary',
    claim: topic,
    summary: topic,
    confidence: 'medium',
    status,
    evidenceRefs: files.map((file) => ({ type: 'file', path: file })),
    scopeRefs: {
      files,
      symbols: ['getSession'],
      domains: ['auth'],
      packages: [],
    },
    provenance: {
      sourceCommand: 'conclude',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    lifecycle: {
      supersedes: [],
      ...(status === 'needs-review'
        ? { invalidatedBy: ['changed file:src/auth.ts'] }
        : {}),
    },
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
    expect(result.meta.atomCount).toBe(0);
    expect(result.meta.cognitionCount).toBe(0);
  });

  it('creates a file node for each file with correct color', () => {
    const fileMap: FileMap = {
      generatedAt: '',
      files: [{ ...makeFile('f1', 'src/auth.ts', 'typescript'), tokenEstimate: 240 }],
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
    expect(node.data.tokenEstimate).toBe(240);
    expect(node.data.tokenBucket).toBe('medium');
    expect(node.classes).toContain('file');
    expect(node.classes).toContain('token-medium');
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

  it('creates atom nodes with ref edges to known files', () => {
    const fileMap: FileMap = {
      generatedAt: '',
      files: [makeFile('f1', 'src/auth.ts', 'typescript')],
    };
    const atom = makeAtom('n1', 'Auth Notes', ['src/auth.ts']);
    const result = buildGraph(
      fileMap,
      emptyMaps.symbolMap,
      emptyMaps.depMap,
      emptyMaps.relMap,
      [atom],
    );
    const cogNode = result.elements.find((e) => e.data.id === 'atom-n1');
    expect(cogNode).toBeDefined();
    expect(cogNode?.data.type).toBe('atom');
    expect(cogNode?.data.color).toBe('#10b981');
    expect(cogNode?.classes).toContain('atom');
    const refEdge = result.elements.find(
      (e) => e.data.type === 'atom-ref',
    );
    expect(refEdge).toBeDefined();
    expect(refEdge?.data.target).toBe('f1');
  });

  it('skips atom ref edges for files not in the file map', () => {
    const atom = makeAtom('n1', 'Notes', ['src/deleted.ts'], 'stale');
    const result = buildGraph(
      emptyMaps.fileMap,
      emptyMaps.symbolMap,
      emptyMaps.depMap,
      emptyMaps.relMap,
      [atom],
    );
    const refEdges = result.elements.filter(
      (e) => e.data.type === 'atom-ref',
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
    const atom = makeAtom('n1', 'N', []);
    const result = buildGraph(
      fileMap,
      symbolMap,
      emptyMaps.depMap,
      emptyMaps.relMap,
      [atom],
    );
    expect(result.meta.fileCount).toBe(2);
    expect(result.meta.symbolCount).toBe(1);
    expect(result.meta.atomCount).toBe(1);
    expect(result.meta.cognitionCount).toBe(1);
    expect(result.meta.tokenEstimate).toBe(0);
  });

  it('caps rendered atom nodes for large memory sets', () => {
    const atoms = Array.from({ length: 260 }, (_, index) =>
      makeAtom(`a${index}`, `Atom ${index}`, []),
    );
    const result = buildGraph(
      emptyMaps.fileMap,
      emptyMaps.symbolMap,
      emptyMaps.depMap,
      emptyMaps.relMap,
      atoms,
    );
    expect(result.elements.filter((e) => e.data.type === 'atom')).toHaveLength(250);
    expect(result.meta.atomCount).toBe(260);
    expect(result.meta.hiddenAtomCount).toBe(10);
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

  it('creates calls and symbol ownership edges from the relationship map', () => {
    const fileMap: FileMap = {
      generatedAt: '',
      files: [makeFile('a.ts', 'a.ts', 'typescript')],
    };
    const classId = 'a.ts#class#AuthService#1#6';
    const methodId = 'a.ts#method#AuthService#refresh#2#4';
    const helperId = 'a.ts#function#refreshSession#8#10';
    const symbolMap: SymbolMap = {
      generatedAt: '',
      symbols: [
        {
          id: classId,
          name: 'AuthService',
          kind: 'class',
          filePath: 'a.ts',
          exported: true,
        },
        {
          id: methodId,
          name: 'refresh',
          kind: 'method',
          filePath: 'a.ts',
          exported: false,
          parentName: 'AuthService',
        },
        {
          id: helperId,
          name: 'refreshSession',
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
    };

    const result = buildGraph(
      fileMap,
      symbolMap,
      emptyMaps.depMap,
      relMap,
      [],
    );

    expect(
      result.elements.find((e) => e.data.type === 'symbol-contains'),
    ).toBeDefined();
    expect(result.elements.find((e) => e.data.type === 'calls')).toBeDefined();
  });
});
