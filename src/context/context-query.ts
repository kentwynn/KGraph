import {
  getRecentlyCommittedFiles,
  getWorkingTreeChangesDetailed,
  isGitRepo,
} from '../scanner/git-utils.js';
import {
  readCognitionNotes,
  readDomainRecords,
} from '../storage/cognition-store.js';
import type { ContextResponse, GitContextChange } from '../types/cognition.js';
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
  let relevantFiles = rankByFields(query, maps.fileMap.files, [
    { name: 'path', value: (file) => file.path },
    { name: 'language', value: (file) => file.language },
  ])
    .map((ranked) => ({
      ...ranked,
      score: ranked.score - Math.floor((ranked.item.tokenEstimate ?? 0) / 2000),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
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

  // Inject files linked by matched cognition notes/domains that didn't score on name alone
  const rankedFilePaths = new Set(relevantFiles.map((f) => f.item.path));
  const cognitionLinkedMap = new Map<string, string[]>();
  for (const ranked of relevantCognition) {
    for (const fp of ranked.item.relatedFiles) {
      if (!rankedFilePaths.has(fp)) {
        const reasons = cognitionLinkedMap.get(fp) ?? [];
        reasons.push(`linked by cognition note "${ranked.item.title}"`);
        cognitionLinkedMap.set(fp, reasons);
      }
    }
  }
  for (const ranked of matchedDomains) {
    for (const fp of ranked.item.files) {
      if (!rankedFilePaths.has(fp)) {
        const reasons = cognitionLinkedMap.get(fp) ?? [];
        reasons.push(`in domain "${ranked.item.name}"`);
        cognitionLinkedMap.set(fp, reasons);
      }
    }
  }
  relevantFiles = [
    ...relevantFiles,
    ...maps.fileMap.files
      .filter((f) => cognitionLinkedMap.has(f.path))
      .map((f) => ({
        item: f,
        score: 1,
        reasons: cognitionLinkedMap.get(f.path)!,
      })),
  ];

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
  const matchedCognitionIds = new Set(relevantCognition.map((r) => r.item.id));
  const staleReferences = cognition
    .filter(
      (note) =>
        matchedCognitionIds.has(note.id) &&
        (note.referencesStatus === 'stale' ||
          note.referencesStatus === 'unresolved' ||
          note.referencesStatus === 'mixed'),
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
  // Skip generic utility/barrel files with many exports — surface only focused modules
  const exportCountByFile = new Map<string, number>();
  for (const s of maps.symbolMap.symbols) {
    if (s.exported) {
      exportCountByFile.set(
        s.filePath,
        (exportCountByFile.get(s.filePath) ?? 0) + 1,
      );
    }
  }
  const MAX_NEARBY_FILE_EXPORTS = 15;
  const relevantImportedFilePaths = new Set(
    [...importedFilePaths].filter(
      (fp) => (exportCountByFile.get(fp) ?? 0) <= MAX_NEARBY_FILE_EXPORTS,
    ),
  );
  const nearbySymbols = maps.symbolMap.symbols
    .filter(
      (s) =>
        s.exported &&
        relevantImportedFilePaths.has(s.filePath) &&
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

  // Collect git changes: working-tree and recently committed files known to KGraph
  const knownFilePaths = new Set(maps.fileMap.files.map((f) => f.path));
  const gitChanges: GitContextChange[] = [];
  if (await isGitRepo(workspace.rootPath)) {
    const workingTreeChanges = await getWorkingTreeChangesDetailed(
      workspace.rootPath,
    );
    for (const change of workingTreeChanges) {
      if (!knownFilePaths.has(change.path)) continue;
      const status =
        change.staged && !change.unstaged
          ? 'staged'
          : change.unstaged && !change.staged
            ? 'unstaged'
            : 'staged'; // both staged and unstaged → report as staged
      gitChanges.push({
        path: change.path,
        status,
        reason:
          change.staged && change.unstaged
            ? 'partially staged'
            : status === 'staged'
              ? 'staged change'
              : 'unstaged change',
      });
    }
    const committedPaths = new Set(gitChanges.map((c) => c.path));
    const recentCommitted = await getRecentlyCommittedFiles(workspace.rootPath);
    for (const filePath of recentCommitted) {
      if (!knownFilePaths.has(filePath) || committedPaths.has(filePath))
        continue;
      gitChanges.push({
        path: filePath,
        status: 'recent-commit',
        reason: 'changed in recent commits',
      });
    }
  }

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
    gitChanges,
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
    for (const reason of rankedReasons.get(relationshipKey(relationship)) ??
      []) {
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
