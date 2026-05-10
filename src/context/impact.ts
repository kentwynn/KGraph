import type { CognitionNote } from '../types/cognition.js';
import type {
  DependencyMap,
  FileMap,
  Relationship,
  RelationshipMap,
  SymbolMap,
} from '../types/maps.js';
import { rankByFields, type Ranked } from './ranking.js';

export interface ImpactResponse {
  query: string;
  files: Ranked<FileMap['files'][number]>[];
  symbols: Ranked<SymbolMap['symbols'][number]>[];
  importedBy: string[];
  callers: Relationship[];
  calls: Relationship[];
  ownership: Relationship[];
  relatedCognition: CognitionNote[];
  risk: string[];
}

export function analyzeImpact(
  query: string,
  maps: {
    fileMap: FileMap;
    symbolMap: SymbolMap;
    dependencyMap: DependencyMap;
    relationshipMap: RelationshipMap;
  },
  cognition: CognitionNote[],
  max = 8,
): ImpactResponse {
  const files = rankByFields(query, maps.fileMap.files, [
    { name: 'path', value: (file) => file.path },
    { name: 'language', value: (file) => file.language },
  ]).slice(0, max);
  const symbols = rankByFields(query, maps.symbolMap.symbols, [
    { name: 'name', value: (symbol) => symbol.name },
    { name: 'path', value: (symbol) => symbol.filePath },
    { name: 'kind', value: (symbol) => symbol.kind },
    { name: 'parent', value: (symbol) => symbol.parentName },
  ]).slice(0, max);

  const filePaths = new Set([
    ...files.map((file) => file.item.path),
    ...symbols.map((symbol) => symbol.item.filePath),
  ]);
  const symbolIds = new Set(symbols.map((symbol) => symbol.item.id));
  const symbolNames = new Set(symbols.map((symbol) => symbol.item.name));
  const importHints = new Set([
    ...[...filePaths].map((file) => basenameWithoutExtension(file).toLowerCase()),
    ...[...symbolNames].map((name) => name.toLowerCase()),
  ]);

  const importedBy = unique(
    maps.dependencyMap.dependencies
      .filter(
        (dep) =>
          (dep.resolvedFile && filePaths.has(dep.resolvedFile)) ||
          [...importHints].some((hint) => hint && dep.specifier.toLowerCase().includes(hint)),
      )
      .map((dep) => dep.fromFile),
  ).slice(0, max);

  const calls = maps.relationshipMap.relationships
    .filter(
      (rel) =>
        rel.relationshipType === 'calls' &&
        (symbolIds.has(rel.sourceId) || symbolNames.has(rel.sourceId)),
    )
    .slice(0, max);
  const callers = maps.relationshipMap.relationships
    .filter(
      (rel) =>
        rel.relationshipType === 'calls' &&
        (symbolIds.has(rel.targetId) || symbolNames.has(rel.targetId) || [...symbolNames].some((name) => rel.targetId.endsWith(`#${name}`))),
    )
    .slice(0, max);
  const ownership = maps.relationshipMap.relationships
    .filter(
      (rel) =>
        rel.relationshipType === 'symbol-contains' &&
        (symbolIds.has(rel.sourceId) || symbolIds.has(rel.targetId)),
    )
    .slice(0, max);

  const relatedCognition = cognition
    .filter(
      (note) =>
        note.relatedFiles.some((file) => filePaths.has(file)) ||
        note.relatedSymbols.some((symbol) => symbolNames.has(symbol) || symbolIds.has(symbol)),
    )
    .slice(0, max);

  const risk: string[] = [];
  if (importedBy.length > 2) risk.push(`Shared file imported by ${importedBy.length} files`);
  if (callers.length > 2) risk.push(`Symbol called by ${callers.length} known callers`);
  if (relatedCognition.some((note) => note.referencesStatus !== 'current')) {
    risk.push('Related cognition has stale or mixed references');
  }
  if (calls.some((rel) => rel.confidence === 'low') || callers.some((rel) => rel.confidence === 'low')) {
    risk.push('Some call relationships are low confidence');
  }

  return {
    query,
    files,
    symbols,
    importedBy,
    callers,
    calls,
    ownership,
    relatedCognition,
    risk,
  };
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function basenameWithoutExtension(filePath: string): string {
  const basename = filePath.split('/').pop() ?? filePath;
  return basename.replace(/\.[^.]+$/, '');
}
