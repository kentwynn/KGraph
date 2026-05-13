import { mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import {
  atomToCognitionNote,
  refreshKnowledgeAtomStatuses,
  writeKnowledgeAtoms,
} from '../knowledge/atom-store.js';
import { buildSessionReport } from '../session/session-store.js';
import {
  overwriteDomainRecord,
  readCognitionNotes,
  readDomainRecords,
  writeCognitionNote,
} from '../storage/cognition-store.js';
import type {
  CognitionNote,
  DomainRecord,
  ReferenceStatus,
} from '../types/cognition.js';
import type { KGraphWorkspace } from '../types/config.js';
import type { KnowledgeAtom } from '../types/knowledge.js';
import type {
  DependencyMap,
  FileMap,
  RelationshipMap,
  SymbolMap,
} from '../types/maps.js';

export interface CognitionRepairChange {
  noteId: string;
  title: string;
  removedFileRefs: string[];
  removedSymbolRefs: string[];
  nextStatus: ReferenceStatus;
}

export interface CognitionQualityReport {
  atomCount: number;
  staleAtomCount: number;
  needsReviewAtomCount: number;
  archivedAtomCount: number;
  duplicateAtomTopicCount: number;
  noteCount: number;
  mixedOrStaleCount: number;
  noisyFileRefCount: number;
  noisySymbolRefCount: number;
  unresolvedLocalImportCount: number;
  unresolvedCallCount: number;
  duplicateTitleCount: number;
  generatedFileScanCount: number;
  expensiveFileCount: number;
  highConfidenceMissingEvidenceCount: number;
  sessionRepeatedReadCount: number;
  sessionEstimatedReadTokens: number;
  sessionEstimatedRepeatedReadTokens: number;
  orphanedNoteCount: number;
  changes: CognitionRepairChange[];
}

export async function analyzeCognitionQuality(
  workspace: KGraphWorkspace,
  maps: {
    fileMap: FileMap;
    symbolMap: SymbolMap;
    dependencyMap?: DependencyMap;
    relationshipMap?: RelationshipMap;
  },
): Promise<CognitionQualityReport> {
  const refreshed = await refreshKnowledgeAtomStatuses(
    workspace,
    { fileMap: maps.fileMap, symbolMap: maps.symbolMap },
    true,
  );
  const atoms = refreshed.atoms;
  const activeAtoms = atoms.filter((atom) => atom.status !== 'archived');
  const notes = activeAtoms.map(atomToCognitionNote);
  const session = await buildSessionReport(workspace);
  const changes = notes
    .map((note) => analyzeNote(note, maps))
    .filter(
      (change) =>
        change.removedFileRefs.length > 0 ||
        change.removedSymbolRefs.length > 0,
    );
  const orphanedNoteCount = notes.filter(
    (note) => note.referencesStatus === 'stale',
  ).length;

  return {
    atomCount: activeAtoms.length,
    staleAtomCount: activeAtoms.filter((atom) => atom.status === 'stale').length,
    needsReviewAtomCount: activeAtoms.filter((atom) => atom.status === 'needs-review').length,
    archivedAtomCount: atoms.filter((atom) => atom.status === 'archived').length,
    duplicateAtomTopicCount: countDuplicateAtomTopics(activeAtoms),
    noteCount: notes.length,
    mixedOrStaleCount: notes.filter((note) =>
      ['mixed', 'stale', 'unresolved'].includes(note.referencesStatus),
    ).length,
    noisyFileRefCount: changes.reduce(
      (total, change) => total + change.removedFileRefs.length,
      0,
    ),
    noisySymbolRefCount: changes.reduce(
      (total, change) => total + change.removedSymbolRefs.length,
      0,
    ),
    unresolvedLocalImportCount: countUnresolvedLocalImports(maps.dependencyMap),
    unresolvedCallCount: countUnresolvedCalls(
      maps.symbolMap,
      maps.relationshipMap,
    ),
    duplicateTitleCount: countDuplicateAtomTopics(activeAtoms),
    generatedFileScanCount: countGeneratedScannedFiles(maps.fileMap),
    expensiveFileCount: countExpensiveFiles(maps.fileMap),
    highConfidenceMissingEvidenceCount:
      countHighConfidenceMissingEvidence(activeAtoms),
    sessionRepeatedReadCount: session.repeatedReadCount,
    sessionEstimatedReadTokens: session.estimatedReadTokens,
    sessionEstimatedRepeatedReadTokens: session.estimatedRepeatedReadTokens,
    orphanedNoteCount,
    changes,
  };
}

function countHighConfidenceMissingEvidence(atoms: KnowledgeAtom[]): number {
  return atoms.filter(
    (atom) => atom.confidence === 'high' && atom.evidenceRefs.length === 0,
  ).length;
}

export async function repairCognition(
  workspace: KGraphWorkspace,
  maps: {
    fileMap: FileMap;
    symbolMap: SymbolMap;
    dependencyMap?: DependencyMap;
    relationshipMap?: RelationshipMap;
  },
  dryRun = false,
): Promise<CognitionQualityReport> {
  const refreshed = await refreshKnowledgeAtomStatuses(
    workspace,
    { fileMap: maps.fileMap, symbolMap: maps.symbolMap },
    dryRun,
  );
  const atoms = refreshed.atoms;
  const activeAtoms = atoms.filter((atom) => atom.status !== 'archived');
  const notes = activeAtoms.map(atomToCognitionNote);
  const session = await buildSessionReport(workspace);
  const nextNotes: CognitionNote[] = [];
  const changes: CognitionRepairChange[] = [];
  const changesById = new Map<string, CognitionRepairChange>();

  for (const note of notes) {
    const change = analyzeNote(note, maps);
    const nextNote = applyChange(note, change);
    nextNotes.push(nextNote);
    if (
      change.removedFileRefs.length > 0 ||
      change.removedSymbolRefs.length > 0
    ) {
      changes.push(change);
      changesById.set(change.noteId, change);
      if (!dryRun) {
        await writeCognitionNote(workspace, nextNote);
      }
    }
  }

  // Archive fully-orphaned notes (all refs dead) so they no longer appear in context
  const orphanedNotes = nextNotes.filter(
    (note) => note.referencesStatus === 'stale',
  );

  if (!dryRun && (changes.length > 0 || orphanedNotes.length > 0)) {
    const now = new Date().toISOString();
    const nextAtoms = atoms.map((atom) => {
      if (atom.status === 'archived') return atom;
      const change = changesById.get(atom.id);
      if (!change && !orphanedNotes.some((note) => note.id === atom.id)) {
        return atom;
      }
      if (orphanedNotes.some((note) => note.id === atom.id)) {
        return {
          ...atom,
          status: 'archived' as const,
          confidence: 'low' as const,
          lifecycle: { ...atom.lifecycle, archivedAt: now },
          provenance: { ...atom.provenance, updatedAt: now },
        };
      }
      const removedFiles = new Set(change?.removedFileRefs ?? []);
      const removedSymbols = new Set(change?.removedSymbolRefs ?? []);
      const nextStatus = atomStatusFromReferenceStatus(change?.nextStatus ?? 'current');
      return {
        ...atom,
        status: nextStatus,
        confidence:
          atom.confidence === 'low' && atom.status === 'stale' && nextStatus !== 'stale'
            ? 'medium'
            : atom.confidence,
        scopeRefs: {
          ...atom.scopeRefs,
          files: atom.scopeRefs.files.filter((file) => !removedFiles.has(file)),
          symbols: atom.scopeRefs.symbols.filter((symbol) => !removedSymbols.has(symbol)),
        },
        evidenceRefs: atom.evidenceRefs.filter((ref) => {
          if (ref.type === 'file') return !removedFiles.has(ref.path);
          if (ref.type === 'symbol') return !removedSymbols.has(ref.name);
          return true;
        }),
        lifecycle: {
          ...atom.lifecycle,
          invalidatedBy:
            change?.nextStatus === 'current'
              ? undefined
              : atom.lifecycle.invalidatedBy,
        },
        provenance: { ...atom.provenance, updatedAt: now },
      };
    });
    await writeKnowledgeAtoms(workspace, nextAtoms);
    // Exclude fully-orphaned notes from domain records — they are being archived
    await repairDomainRecords(
      workspace,
      nextAtoms
        .filter((atom) => atom.status !== 'archived')
        .map(atomToCognitionNote),
      maps,
    );
  }

  if (!dryRun) {
    for (const note of orphanedNotes) {
      await archiveOrphanedNote(workspace, note);
    }
  }
  const orphanedNoteCount = orphanedNotes.length;

  return {
    atomCount: activeAtoms.length,
    staleAtomCount: nextNotes.filter((note) => note.referencesStatus === 'stale').length,
    needsReviewAtomCount: nextNotes.filter((note) => note.referencesStatus === 'mixed').length,
    archivedAtomCount: atoms.filter((atom) => atom.status === 'archived').length + orphanedNoteCount,
    duplicateAtomTopicCount: countDuplicateTitles(nextNotes),
    noteCount: notes.length,
    mixedOrStaleCount: nextNotes.filter((note) =>
      ['mixed', 'stale', 'unresolved'].includes(note.referencesStatus),
    ).length,
    noisyFileRefCount: changes.reduce(
      (total, change) => total + change.removedFileRefs.length,
      0,
    ),
    noisySymbolRefCount: changes.reduce(
      (total, change) => total + change.removedSymbolRefs.length,
      0,
    ),
    unresolvedLocalImportCount: countUnresolvedLocalImports(maps.dependencyMap),
    unresolvedCallCount: countUnresolvedCalls(
      maps.symbolMap,
      maps.relationshipMap,
    ),
    duplicateTitleCount: countDuplicateTitles(nextNotes),
    generatedFileScanCount: countGeneratedScannedFiles(maps.fileMap),
    expensiveFileCount: countExpensiveFiles(maps.fileMap),
    highConfidenceMissingEvidenceCount:
      countHighConfidenceMissingEvidence(atoms),
    sessionRepeatedReadCount: session.repeatedReadCount,
    sessionEstimatedReadTokens: session.estimatedReadTokens,
    sessionEstimatedRepeatedReadTokens: session.estimatedRepeatedReadTokens,
    orphanedNoteCount,
    changes,
  };
}

function countUnresolvedLocalImports(dependencyMap?: DependencyMap): number {
  return (
    dependencyMap?.dependencies.filter(
      (dependency) => dependency.kind === 'local' && !dependency.resolvedFile,
    ).length ?? 0
  );
}

function countUnresolvedCalls(
  symbolMap: SymbolMap,
  relationshipMap?: RelationshipMap,
): number {
  const symbolIds = new Set(symbolMap.symbols.map((symbol) => symbol.id));
  const symbolNames = new Set(symbolMap.symbols.map((symbol) => symbol.name));
  return (
    relationshipMap?.relationships.filter(
      (relationship) =>
        relationship.relationshipType === 'calls' &&
        relationship.targetType === 'symbol' &&
        !symbolIds.has(relationship.targetId) &&
        !symbolNames.has(relationship.targetId) &&
        ![...symbolNames].some((name) =>
          relationship.targetId.endsWith(`#${name}`),
        ),
    ).length ?? 0
  );
}

function countDuplicateTitles(notes: CognitionNote[]): number {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const note of notes) {
    const key = note.title.trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }
  return duplicates.size;
}

function countDuplicateAtomTopics(atoms: KnowledgeAtom[]): number {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const atom of atoms) {
    const key = [
      atom.type,
      atom.topic.trim().toLowerCase(),
      atom.claim.trim().toLowerCase(),
    ].join('\0');
    if (!atom.topic.trim()) continue;
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }
  return duplicates.size;
}

function countGeneratedScannedFiles(fileMap: FileMap): number {
  return fileMap.files.filter((file) =>
    [
      '.agents/',
      '.claude/',
      '.cursor/',
      '.windsurf/',
      '.clinerules/',
      '.github/prompts/',
      'AGENTS.md',
      'CLAUDE.md',
      'GEMINI.md',
    ].some((prefix) => file.path === prefix || file.path.startsWith(prefix)),
  ).length;
}

function countExpensiveFiles(fileMap: FileMap): number {
  return fileMap.files.filter((file) => (file.tokenEstimate ?? 0) >= 1000)
    .length;
}

function analyzeNote(
  note: CognitionNote,
  maps: { fileMap: FileMap; symbolMap: SymbolMap },
): CognitionRepairChange {
  const filePaths = new Set(maps.fileMap.files.map((file) => file.path));
  const symbolNames = new Set(
    maps.symbolMap.symbols.map((symbol) => symbol.name),
  );
  const removedFileRefs = note.relatedFiles.filter(
    (ref) => !filePaths.has(ref) && isNoisyFileRef(ref),
  );
  const removedSymbolRefs = note.relatedSymbols.filter(
    (ref) => !symbolNames.has(ref) && isNoisySymbolRef(ref),
  );
  const nextFiles = note.relatedFiles.filter(
    (ref) => !removedFileRefs.includes(ref),
  );
  const nextSymbols = note.relatedSymbols.filter(
    (ref) => !removedSymbolRefs.includes(ref),
  );

  return {
    noteId: note.id,
    title: note.title,
    removedFileRefs,
    removedSymbolRefs,
    nextStatus: evaluateReferenceStatus(nextFiles, nextSymbols, maps),
  };
}

function applyChange(
  note: CognitionNote,
  change: CognitionRepairChange,
): CognitionNote {
  return {
    ...note,
    relatedFiles: note.relatedFiles.filter(
      (ref) => !change.removedFileRefs.includes(ref),
    ),
    relatedSymbols: note.relatedSymbols.filter(
      (ref) => !change.removedSymbolRefs.includes(ref),
    ),
    referencesStatus: change.nextStatus,
  };
}

async function repairDomainRecords(
  workspace: KGraphWorkspace,
  notes: CognitionNote[],
  maps: { fileMap: FileMap; symbolMap: SymbolMap },
): Promise<void> {
  const domains = await readDomainRecords(workspace);
  const filePaths = new Set(maps.fileMap.files.map((file) => file.path));
  const symbolNames = new Set(
    maps.symbolMap.symbols.map((symbol) => symbol.name),
  );
  const notesById = new Map(notes.map((note) => [note.id, note]));

  for (const domain of domains) {
    const relatedNotes = domain.cognitionNotes
      .map((id) => notesById.get(id))
      .filter((note): note is CognitionNote => Boolean(note));
    const next: DomainRecord = {
      ...domain,
      pathHints: unique(relatedNotes.flatMap((note) => note.relatedFiles)),
      files: unique(
        relatedNotes
          .flatMap((note) => note.relatedFiles)
          .filter((file) => filePaths.has(file)),
      ),
      symbols: unique(
        relatedNotes
          .flatMap((note) => note.relatedSymbols)
          .filter((symbol) => symbolNames.has(symbol)),
      ),
    };
    await overwriteDomainRecord(workspace, next);
  }
}

function evaluateReferenceStatus(
  relatedFiles: string[],
  relatedSymbols: string[],
  maps: { fileMap: FileMap; symbolMap: SymbolMap },
): ReferenceStatus {
  const filePaths = new Set(maps.fileMap.files.map((file) => file.path));
  const symbolNames = new Set(
    maps.symbolMap.symbols.map((symbol) => symbol.name),
  );
  const references = [
    ...relatedFiles.map((file) => filePaths.has(file)),
    ...relatedSymbols.map((symbol) => symbolNames.has(symbol)),
  ];
  if (references.length === 0) return 'unresolved';
  if (references.every(Boolean)) return 'current';
  if (references.every((value) => !value)) return 'stale';
  return 'mixed';
}

function atomStatusFromReferenceStatus(
  status: ReferenceStatus,
): KnowledgeAtom['status'] {
  if (status === 'current') return 'active';
  if (status === 'mixed') return 'needs-review';
  return 'stale';
}

function isNoisyFileRef(ref: string): boolean {
  return (
    !ref.includes('/') && /^[A-Z][A-Za-z0-9_-]*\.[A-Za-z0-9_-]+$/.test(ref)
  );
}

function isNoisySymbolRef(ref: string): boolean {
  // Only treat as noise if the ref is a short all-lowercase word (no camelCase, no _ or $).
  // Preserve camelCase refs even when unresolved — the symbol may have been renamed.
  if (/[A-Z_$]/.test(ref)) return false;
  return ref.length <= 5;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

async function archiveOrphanedNote(
  workspace: KGraphWorkspace,
  note: CognitionNote,
): Promise<void> {
  const archivedDir = path.join(workspace.cognitionPath, 'archived');
  await mkdir(archivedDir, { recursive: true });
  const source = path.join(workspace.cognitionPath, `${note.id}.md`);
  const target = path.join(archivedDir, `${note.id}.md`);
  try {
    await rename(source, target);
  } catch {
    // source file may already be missing — ignore
  }
}
