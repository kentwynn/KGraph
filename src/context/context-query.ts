import {
  getRecentlyCommittedFiles,
  getWorkingTreeChangesDetailed,
  isGitRepo,
} from '../scanner/git-utils.js';
import { readDomainRecords } from '../storage/cognition-store.js';
import { readSessionState } from '../session/session-store.js';
import {
  atomToCognitionNote,
  refreshKnowledgeAtomStatuses,
} from '../knowledge/atom-store.js';
import type { ContextResponse, GitContextChange } from '../types/cognition.js';
import type { KGraphConfig, KGraphWorkspace } from '../types/config.js';
import type { KnowledgeAtom } from '../types/knowledge.js';
import type {
  CodeSymbol,
  DependencyMap,
  FileMap,
  Relationship,
  RelationshipMap,
  SymbolMap,
} from '../types/maps.js';
import { rankByFields, type Ranked } from './ranking.js';
import { tokenize } from './ranking.js';

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
  const refreshedAtoms = await refreshKnowledgeAtomStatuses(workspace, {
    fileMap: maps.fileMap,
    symbolMap: maps.symbolMap,
  });
  const atoms = refreshedAtoms.atoms;
  const cognition = atoms
    .filter((atom) => atom.status !== 'archived')
    .map(atomToCognitionNote);
  const domains = await readDomainRecords(workspace);
  const session = await readSessionState(workspace);
  const sessionTouchedPaths = new Set(
    session.events
      .map((event) => event.path)
      .filter((path): path is string => Boolean(path)),
  );
  const max = config.maxContextItems;

  // Collect git changes before file ranking so dirty files can influence ranking,
  // not just appear later as a low-token pack item.
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
            : 'staged'; // both staged and unstaged -> report as staged
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
  const gitChangedPaths = new Set(gitChanges.map((change) => change.path));

  const relevantCognition = rankByFields(
    query,
    atoms.filter((atom) => atom.status !== 'archived'),
    [
      { name: 'topic', value: (atom) => atom.topic },
      { name: 'claim', value: (atom) => atom.claim },
      { name: 'type', value: (atom) => atom.type },
      { name: 'confidence', value: (atom) => atom.confidence },
      { name: 'status', value: (atom) => atom.status },
      { name: 'source', value: (atom) => atom.provenance.sourceCommand },
      { name: 'domains', value: (atom) => atom.scopeRefs.domains },
      { name: 'files', value: (atom) => atom.scopeRefs.files },
      { name: 'symbols', value: (atom) => atom.scopeRefs.symbols },
      { name: 'summary', value: (atom) => atom.summary },
    ],
  )
    .map((ranked) => applyAtomRankAdjustments(ranked))
    .map((ranked) => ({
      ...ranked,
      item: atomToCognitionNote(ranked.item),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
  const atomLinkedFiles = new Map<string, string[]>();
  for (const ranked of relevantCognition) {
    for (const fp of ranked.item.relatedFiles) {
      atomLinkedFiles.set(fp, [
        ...(atomLinkedFiles.get(fp) ?? []),
        `referenced by matched atom "${ranked.item.title}"`,
      ]);
    }
  }
  const matchedDomains = rankByFields(query, domains, [
    { name: 'name', value: (domain) => domain.name },
    { name: 'tags', value: (domain) => domain.tags },
    { name: 'path', value: (domain) => domain.pathHints },
  ]).slice(0, max);

  let relevantFiles = rankByFields(query, maps.fileMap.files, [
    { name: 'path', value: (file) => file.path },
    { name: 'language', value: (file) => file.language },
  ])
    .map((ranked) =>
      applyFileRankAdjustments(ranked, {
        query,
        atomLinkedFiles,
        gitChangedPaths,
        sessionTouchedPaths,
      }),
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
  const relevantSymbols = rankByFields(query, maps.symbolMap.symbols, [
    { name: 'name', value: (symbol) => symbol.name },
    { name: 'path', value: (symbol) => symbol.filePath },
    { name: 'kind', value: (symbol) => symbol.kind },
    { name: 'parent', value: (symbol) => symbol.parentName },
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
  // Apply domainHints from config: inject paths for hints whose name matches the query
  const queryTokens = new Set(
    query
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );
  for (const [hintName, hint] of Object.entries(config.domainHints)) {
    const hintWords = hintName
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
    if (!hintWords.some((w) => queryTokens.has(w))) continue;
    for (const fp of hint.paths ?? []) {
      if (!rankedFilePaths.has(fp)) {
        const reasons = cognitionLinkedMap.get(fp) ?? [];
        reasons.push(`in configured domain hint "${hintName}"`);
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
        score: 12,
        reasons: cognitionLinkedMap.get(f.path)!,
      })),
  ].sort((a, b) => b.score - a.score);

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

function applyFileRankAdjustments<T extends { path: string; tokenEstimate?: number }>(
  ranked: Ranked<T>,
  context: {
    query: string;
    atomLinkedFiles: Map<string, string[]>;
    gitChangedPaths: Set<string>;
    sessionTouchedPaths: Set<string>;
  },
): Ranked<T> {
  const reasons = [...ranked.reasons];
  let score = ranked.score - Math.floor((ranked.item.tokenEstimate ?? 0) / 2000);

  if (context.sessionTouchedPaths.has(ranked.item.path)) {
    score += 3;
    reasons.push('touched in current session');
  }
  if (context.gitChangedPaths.has(ranked.item.path)) {
    score += 10;
    reasons.push('current git change');
  }
  const atomReasons = context.atomLinkedFiles.get(ranked.item.path) ?? [];
  if (atomReasons.length > 0) {
    score += 12;
    reasons.push(...atomReasons);
  }

  const strongTokens = tokenize(context.query).filter(
    (token) =>
      token.length >= 4 &&
      !['page', 'work', 'file', 'component', 'app'].includes(token),
  );
  const pathTokens = new Set(tokenize(ranked.item.path));
  const strongMatches = strongTokens.filter((token) => pathTokens.has(token));
  if (strongMatches.length > 0) {
    score += strongMatches.length * 3;
    reasons.push(`path matched specific query token(s): ${strongMatches.join(', ')}`);
  } else if (strongTokens.length > 0) {
    score -= 6;
    reasons.push('generic path-only match penalty');
  }

  return { ...ranked, score, reasons };
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

function applyAtomRankAdjustments(ranked: Ranked<KnowledgeAtom>): Ranked<KnowledgeAtom> {
  const reasons = [...ranked.reasons];
  let score = ranked.score;
  if (ranked.item.confidence === 'high') {
    score += 4;
    reasons.push('high confidence atom');
  } else if (ranked.item.confidence === 'medium') {
    score += 1;
    reasons.push('medium confidence atom');
  } else {
    score -= 3;
    reasons.push('low confidence penalty');
  }
  if (ranked.item.status === 'active') {
    score += 3;
    reasons.push('active atom evidence');
  } else if (ranked.item.status === 'needs-review') {
    score -= 2;
    reasons.push('needs-review stale penalty');
  } else if (ranked.item.status === 'stale') {
    score -= 6;
    reasons.push('stale atom penalty');
  }
  if (ranked.item.type === 'decision' || ranked.item.type === 'gotcha') {
    score += 2;
    reasons.push(`${ranked.item.type} atom`);
  }
  if (ranked.item.provenance.sourceCommand === 'legacy-migration') {
    score -= 1;
    reasons.push('legacy compatibility atom');
  }
  if (ranked.item.lifecycle.supersededBy) {
    score -= 8;
    reasons.push('superseded atom penalty');
  }
  return { ...ranked, score, reasons };
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
