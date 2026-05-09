import type { CognitionNote } from '../types/cognition.js';
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
    cognitionCount: number;
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
  current: '#10b981',
  mixed: '#f59e0b',
  stale: '#ef4444',
  unresolved: '#6b7280',
};

export function buildGraph(
  fileMap: FileMap,
  symbolMap: SymbolMap,
  dependencyMap: DependencyMap,
  _relationshipMap: RelationshipMap,
  cognitionNotes: CognitionNote[],
): GraphData {
  const elements: CytoscapeElement[] = [];
  const edgeIds = new Set<string>();

  for (const file of fileMap.files) {
    elements.push({
      data: {
        id: file.id,
        label: file.path.split('/').pop() ?? file.path,
        path: file.path,
        language: file.language,
        color: LANGUAGE_COLORS[file.language] ?? '#94a3b8',
        type: 'file',
        size: file.sizeBytes,
        scanStatus: file.scanStatus,
      },
      classes: `file ${file.language}`,
    });
  }

  for (const note of cognitionNotes) {
    const id = `cognition-${note.id}`;
    elements.push({
      data: {
        id,
        label: note.title,
        color: STATUS_COLORS[note.referencesStatus] ?? STATUS_COLORS.unresolved,
        type: 'cognition',
        referencesStatus: note.referencesStatus,
        domain: note.domain ?? '',
        relatedFiles: note.relatedFiles,
        relatedSymbols: note.relatedSymbols,
      },
      classes: `cognition ${note.referencesStatus}`,
    });

    for (const filePath of note.relatedFiles) {
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
              type: 'cognition-ref',
              label: '',
            },
            classes: 'cognition-ref',
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

  return {
    elements,
    meta: {
      fileCount: fileMap.files.length,
      symbolCount: symbolMap.symbols.length,
      cognitionCount: cognitionNotes.length,
      generatedAt: new Date().toISOString(),
    },
  };
}
