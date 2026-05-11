import {
  readCognitionNotes,
  readDomainRecords,
} from '../storage/cognition-store.js';
import type { ContextResponse } from '../types/cognition.js';
import type { KGraphConfig, KGraphWorkspace } from '../types/config.js';
import type {
  CodeSymbol,
  DependencyMap,
  FileMap,
  Relationship,
  RelationshipMap,
  SymbolMap,
} from '../types/maps.js';
import { rankByFields, type Ranked } from './ranking.js';

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
    { name: 'parent', value: (symbol) => symbol.parentName },
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
  for (const relationship of maps.relationshipMap.relationships) {
    if (
      relatedIds.has(relationship.sourceId) ||
      relatedIds.has(relationship.targetId)
    ) {
      relatedIds.add(relationship.sourceId);
      relatedIds.add(relationship.targetId);
    }
  }
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
  const relationshipExplanations = explainRelationships(relationships, {
    rankedRelationships,
    relevantFiles,
    relevantSymbols,
    relevantCognition,
    matchedDomains,
  });

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

  // Collect nearby symbols: exported symbols from files 1-hop imported by matched files
  const matchedFilePaths = new Set([
    ...relevantFiles.map((f) => f.item.path),
    ...relevantSymbols.map((s) => s.item.filePath),
  ]);
  const matchedSymbolIds = new Set(relevantSymbols.map((s) => s.item.id));
  const importedFilePaths = new Set<string>();
  for (const dep of maps.dependencyMap.dependencies) {
    if (
      dep.kind === 'local' &&
      dep.resolvedFile &&
      matchedFilePaths.has(dep.fromFile)
    ) {
      importedFilePaths.add(dep.resolvedFile);
    }
  }
  // Remove files already in the matched set
  for (const p of matchedFilePaths) importedFilePaths.delete(p);
  const nearbySymbols = maps.symbolMap.symbols
    .filter(
      (s) =>
        s.exported &&
        importedFilePaths.has(s.filePath) &&
        !matchedSymbolIds.has(s.id),
    )
    .slice(0, max);
  const nearbySymbolExplanations = nearbySymbols.map((symbol) => ({
    symbol,
    reasons: [
      `exported symbol from 1-hop import ${symbol.filePath}`,
      ...dependenciesForImportedSymbol(symbol, maps.dependencyMap.dependencies),
    ],
  }));

  return {
    query,
    matchedDomains,
    relevantFiles,
    relevantSymbols,
    relevantCognition,
    relationships: relationships.slice(0, max),
    relationshipExplanations: relationshipExplanations.slice(0, max),
    nearbySymbols,
    nearbySymbolExplanations,
    staleReferences,
    warnings: [],
  };
}

function explainRelationships(
  relationships: Relationship[],
  context: {
    rankedRelationships: Ranked<Relationship>[];
    relevantFiles: Ranked<{ path: string }>[];
    relevantSymbols: Ranked<{ id?: string; filePath: string; name: string }>[];
    relevantCognition: Ranked<{
      title: string;
      relatedFiles: string[];
      relatedSymbols: string[];
    }>[];
    matchedDomains: Ranked<{
      name: string;
      files: string[];
      symbols: string[];
    }>[];
  },
): Array<{ relationship: Relationship; reasons: string[] }> {
  const rankedReasons = new Map(
    context.rankedRelationships.map((ranked) => [
      relationshipKey(ranked.item),
      ranked.reasons,
    ]),
  );

  return relationships.map((relationship) => {
    const reasons = new Set<string>();
    for (const reason of rankedReasons.get(relationshipKey(relationship)) ?? []) {
      reasons.add(reason);
    }

    for (const file of context.relevantFiles) {
      if (
        relationship.sourceId === file.item.path ||
        relationship.targetId === file.item.path
      ) {
        reasons.add(`connected to matched file ${file.item.path}`);
      }
    }

    for (const symbol of context.relevantSymbols) {
      if (
        relationship.sourceId === symbol.item.id ||
        relationship.targetId === symbol.item.id ||
        relationship.sourceId === symbol.item.name ||
        relationship.targetId === symbol.item.name ||
        relationship.sourceId === symbol.item.filePath ||
        relationship.targetId === symbol.item.filePath
      ) {
        reasons.add(`connected to matched symbol ${symbol.item.name}`);
      }
    }

    for (const note of context.relevantCognition) {
      if (
        note.item.relatedFiles.includes(relationship.sourceId) ||
        note.item.relatedFiles.includes(relationship.targetId) ||
        note.item.relatedSymbols.includes(relationship.sourceId) ||
        note.item.relatedSymbols.includes(relationship.targetId)
      ) {
        reasons.add(`referenced by cognition "${note.item.title}"`);
      }
    }

    for (const domain of context.matchedDomains) {
      if (
        domain.item.files.includes(relationship.sourceId) ||
        domain.item.files.includes(relationship.targetId) ||
        domain.item.symbols.includes(relationship.sourceId) ||
        domain.item.symbols.includes(relationship.targetId)
      ) {
        reasons.add(`inside matched domain ${domain.item.name}`);
      }
    }

    if (reasons.size === 0) {
      reasons.add(`nearby ${relationship.relationshipType} relationship`);
    }

    return { relationship, reasons: [...reasons] };
  });
}

function dependenciesForImportedSymbol(
  symbol: CodeSymbol,
  dependencies: DependencyMap['dependencies'],
): string[] {
  return dependencies
    .filter(
      (dependency) =>
        dependency.kind === 'local' &&
        dependency.resolvedFile === symbol.filePath,
    )
    .map(
      (dependency) =>
        `imported by ${dependency.fromFile} via ${dependency.specifier}`,
    );
}

function relationshipKey(relationship: Relationship): string {
  return [
    relationship.sourceId,
    relationship.targetId,
    relationship.relationshipType,
  ].join('\0');
}
