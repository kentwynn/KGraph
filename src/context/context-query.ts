import {
  readCognitionNotes,
  readDomainRecords,
} from '../storage/cognition-store.js';
import type { ContextResponse } from '../types/cognition.js';
import type { KGraphConfig, KGraphWorkspace } from '../types/config.js';
import type {
  DependencyMap,
  FileMap,
  RelationshipMap,
  SymbolMap,
} from '../types/maps.js';
import { rankByFields } from './ranking.js';

export async function queryContext(
  workspace: KGraphWorkspace,
  config: KGraphConfig,
  maps: {
    fileMap: FileMap;
    symbolMap: SymbolMap;
    dependencyMap: DependencyMap;
    relationshipMap: RelationshipMap;
  },
  query: string,
): Promise<ContextResponse> {
  const cognition = await readCognitionNotes(workspace);
  const domains = await readDomainRecords(workspace);
  const max = config.maxContextItems;
  const relevantFiles = rankByFields(query, maps.fileMap.files, [
    { name: 'path', value: (file) => file.path },
    { name: 'language', value: (file) => file.language },
  ]).slice(0, max);
  const relevantSymbols = rankByFields(query, maps.symbolMap.symbols, [
    { name: 'name', value: (symbol) => symbol.name },
    { name: 'path', value: (symbol) => symbol.filePath },
    { name: 'kind', value: (symbol) => symbol.kind },
  ]).slice(0, max);
  const relevantCognition = rankByFields(query, cognition, [
    { name: 'title', value: (note) => note.title },
    { name: 'domain', value: (note) => note.domain },
    { name: 'tags', value: (note) => note.tags },
    { name: 'files', value: (note) => note.relatedFiles },
    { name: 'symbols', value: (note) => note.relatedSymbols },
    { name: 'summary', value: (note) => note.summary },
  ]).slice(0, max);
  const matchedDomains = rankByFields(query, domains, [
    { name: 'name', value: (domain) => domain.name },
    { name: 'tags', value: (domain) => domain.tags },
    { name: 'path', value: (domain) => domain.pathHints },
  ]).slice(0, max);

  const relatedIds = new Set<string>([
    ...relevantFiles.map((file) => file.item.path),
    ...relevantSymbols.map((symbol) => symbol.item.id),
    ...relevantSymbols.map((symbol) => symbol.item.filePath),
    ...relevantCognition.flatMap((note) => [
      ...note.item.relatedFiles,
      ...note.item.relatedSymbols,
    ]),
    ...matchedDomains.flatMap((domain) => [
      ...domain.item.files,
      ...domain.item.symbols,
    ]),
  ]);
  const rankedRelationships = rankByFields(
    query,
    maps.relationshipMap.relationships,
    [
      { name: 'source', value: (relationship) => relationship.sourceId },
      { name: 'target', value: (relationship) => relationship.targetId },
      { name: 'type', value: (relationship) => relationship.relationshipType },
    ],
  );
  const relationships = [
    ...maps.relationshipMap.relationships.filter(
      (relationship) =>
        relatedIds.has(relationship.sourceId) ||
        relatedIds.has(relationship.targetId),
    ),
    ...rankedRelationships.map((relationship) => relationship.item),
  ].filter(
    (relationship, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.sourceId === relationship.sourceId &&
          candidate.targetId === relationship.targetId &&
          candidate.relationshipType === relationship.relationshipType,
      ) === index,
  );

  const filePaths = new Set(maps.fileMap.files.map((f) => f.path));
  const symbolNames = new Set(maps.symbolMap.symbols.map((s) => s.name));
  const staleReferences = cognition
    .filter(
      (note) =>
        note.referencesStatus === 'stale' ||
        note.referencesStatus === 'unresolved' ||
        note.referencesStatus === 'mixed',
    )
    .flatMap((note) => [
      ...note.relatedFiles
        .filter((f) => !filePaths.has(f))
        .map((ref) => `${note.title}: ${ref}`),
      ...note.relatedSymbols
        .filter((s) => !symbolNames.has(s))
        .map((ref) => `${note.title}: ${ref}`),
    ]);

  return {
    query,
    matchedDomains,
    relevantFiles,
    relevantSymbols,
    relevantCognition,
    relationships: relationships.slice(0, max),
    staleReferences,
    warnings: [],
  };
}
