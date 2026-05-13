import type { KnowledgeAtom } from '../types/knowledge.js';
import type {
  DependencyMap,
  FileMap,
  RelationshipMap,
  SymbolMap,
} from '../types/maps.js';

export interface CytoscapeElement {
  data: Record<string, unknown>;
  classes?: string;
}

export interface GraphData {
  elements: CytoscapeElement[];
  meta: {
    fileCount: number;
    symbolCount: number;
    atomCount: number;
    hiddenAtomCount: number;
    /** @deprecated Kept for older tests/consumers that still read cognitionCount. */
    cognitionCount: number;
    tokenEstimate: number;
    generatedAt: string;
  };
}

const LANGUAGE_COLORS: Record<string, string> = {
  typescript: '#3b82f6',
  javascript: '#f59e0b',
  json: '#6b7280',
  markdown: '#10b981',
  yaml: '#8b5cf6',
  css: '#06b6d4',
  html: '#f97316',
};

const STATUS_COLORS: Record<string, string> = {
  active: '#10b981',
  'needs-review': '#f59e0b',
  stale: '#ef4444',
  archived: '#6b7280',
};

const SYMBOL_COLORS: Record<string, string> = {
  function: '#22c55e',
  class: '#a855f7',
  method: '#14b8a6',
  export: '#f97316',
  import: '#64748b',
};

const MAX_ATOM_NODES = 250;

export function buildGraph(
  fileMap: FileMap,
  symbolMap: SymbolMap,
  dependencyMap: DependencyMap,
  relationshipMap: RelationshipMap,
  knowledgeAtoms: KnowledgeAtom[],
): GraphData {
  const elements: CytoscapeElement[] = [];
  const edgeIds = new Set<string>();
  const nodeIds = new Set<string>();
  const tokenEstimate = fileMap.files.reduce(
    (total, file) => total + (file.tokenEstimate ?? 0),
    0,
  );

  for (const file of fileMap.files) {
    const tokenBucket = getTokenBucket(file.tokenEstimate);
    nodeIds.add(file.id);
    elements.push({
      data: {
        id: file.id,
        label: file.path.split('/').pop() ?? file.path,
        path: file.path,
        language: file.language,
        color: LANGUAGE_COLORS[file.language] ?? '#94a3b8',
        type: 'file',
        size: file.sizeBytes,
        tokenEstimate: file.tokenEstimate ?? 0,
        tokenBucket,
        scanStatus: file.scanStatus,
      },
      classes: `file ${file.language} token-${tokenBucket}`,
    });
  }

  for (const symbol of symbolMap.symbols) {
    nodeIds.add(symbol.id);
    elements.push({
      data: {
        id: symbol.id,
        label: symbol.name,
        path: symbol.filePath,
        kind: symbol.kind,
        parentName: symbol.parentName ?? '',
        type: 'symbol',
        color: SYMBOL_COLORS[symbol.kind] ?? '#94a3b8',
      },
      classes: `symbol ${symbol.kind}`,
    });
  }

  const atomsForGraph = selectAtomsForGraph(knowledgeAtoms);
  for (const atom of atomsForGraph) {
    const id = `atom-${atom.id}`;
    elements.push({
      data: {
        id,
        label: atom.topic,
        color: STATUS_COLORS[atom.status] ?? STATUS_COLORS.archived,
        type: 'atom',
        atomId: atom.id,
        atomType: atom.type,
        confidence: atom.confidence,
        status: atom.status,
        sourceCommand: atom.provenance.sourceCommand,
        domain: atom.scopeRefs.domains[0] ?? '',
        relatedFiles: atom.scopeRefs.files,
        relatedSymbols: atom.scopeRefs.symbols,
        supersededBy: atom.lifecycle.supersededBy ?? '',
        supersedes: atom.lifecycle.supersedes,
        invalidatedBy: atom.lifecycle.invalidatedBy ?? [],
      },
      classes: `atom ${atom.status}`,
    });

    for (const filePath of atom.scopeRefs.files) {
      const target = fileMap.files.find((f) => f.path === filePath);
      if (target) {
        const edgeId = `${id}-ref-${target.id}`;
        if (!edgeIds.has(edgeId)) {
          edgeIds.add(edgeId);
          elements.push({
            data: {
              id: edgeId,
              source: id,
              target: target.id,
              type: 'atom-ref',
              label: '',
            },
            classes: 'atom-ref',
          });
        }
      }
    }
  }

  for (const dep of dependencyMap.dependencies) {
    if (dep.kind !== 'local' || !dep.resolvedFile) continue;
    const src = fileMap.files.find((f) => f.path === dep.fromFile);
    const tgt = fileMap.files.find((f) => f.path === dep.resolvedFile);
    if (src && tgt && src.id !== tgt.id) {
      const edgeId = `import-${src.id}-${tgt.id}`;
      if (!edgeIds.has(edgeId)) {
        edgeIds.add(edgeId);
        elements.push({
          data: {
            id: edgeId,
            source: src.id,
            target: tgt.id,
            type: 'import',
            label: '',
          },
          classes: 'import',
        });
      }
    }
  }

  for (const relationship of relationshipMap.relationships) {
    if (!nodeIds.has(relationship.sourceId) || !nodeIds.has(relationship.targetId)) {
      continue;
    }
    const edgeId = `rel-${relationship.relationshipType}-${relationship.sourceId}-${relationship.targetId}`;
    if (edgeIds.has(edgeId)) {
      continue;
    }
    edgeIds.add(edgeId);
    elements.push({
      data: {
        id: edgeId,
        source: relationship.sourceId,
        target: relationship.targetId,
        type: relationship.relationshipType,
        confidence: relationship.confidence,
        label: relationship.relationshipType,
      },
      classes: `relationship ${relationship.relationshipType}`,
    });
  }

  return {
    elements,
    meta: {
      fileCount: fileMap.files.length,
      symbolCount: symbolMap.symbols.length,
      atomCount: knowledgeAtoms.filter((atom) => atom.status !== 'archived').length,
      hiddenAtomCount: Math.max(
        0,
        knowledgeAtoms.filter((atom) => atom.status !== 'archived').length -
          atomsForGraph.length,
      ),
      cognitionCount: knowledgeAtoms.filter((atom) => atom.status !== 'archived').length,
      tokenEstimate,
      generatedAt: new Date().toISOString(),
    },
  };
}

function selectAtomsForGraph(atoms: KnowledgeAtom[]): KnowledgeAtom[] {
  return atoms
    .filter((atom) => atom.status !== 'archived')
    .sort((left, right) => atomGraphScore(right) - atomGraphScore(left))
    .slice(0, MAX_ATOM_NODES);
}

function atomGraphScore(atom: KnowledgeAtom): number {
  const statusScore =
    atom.status === 'active' ? 6 : atom.status === 'needs-review' ? 4 : 2;
  const confidenceScore =
    atom.confidence === 'high' ? 3 : atom.confidence === 'medium' ? 2 : 0;
  const evidenceScore = Math.min(
    4,
    atom.scopeRefs.files.length + atom.scopeRefs.symbols.length,
  );
  const typeScore = atom.type === 'decision' || atom.type === 'gotcha' ? 1 : 0;
  return statusScore + confidenceScore + evidenceScore + typeScore;
}

function getTokenBucket(tokenEstimate: number | undefined): 'small' | 'medium' | 'large' {
  const tokens = tokenEstimate ?? 0;
  if (tokens >= 1000) return 'large';
  if (tokens >= 200) return 'medium';
  return 'small';
}
