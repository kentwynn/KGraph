import { mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
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
  noteCount: number;
  mixedOrStaleCount: number;
  noisyFileRefCount: number;
  noisySymbolRefCount: number;
  unresolvedLocalImportCount: number;
  unresolvedCallCount: number;
  duplicateTitleCount: number;
  generatedFileScanCount: number;
  expensiveFileCount: number;
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
  const notes = await readCognitionNotes(workspace);
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
    duplicateTitleCount: countDuplicateTitles(notes),
    generatedFileScanCount: countGeneratedScannedFiles(maps.fileMap),
    expensiveFileCount: countExpensiveFiles(maps.fileMap),
    sessionRepeatedReadCount: session.repeatedReadCount,
    sessionEstimatedReadTokens: session.estimatedReadTokens,
    sessionEstimatedRepeatedReadTokens: session.estimatedRepeatedReadTokens,
    orphanedNoteCount,
    changes,
  };
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
  const notes = await readCognitionNotes(workspace);
  const session = await buildSessionReport(workspace);
  const nextNotes: CognitionNote[] = [];
  const changes: CognitionRepairChange[] = [];

  for (const note of notes) {
    const change = analyzeNote(note, maps);
    const nextNote = applyChange(note, change);
    nextNotes.push(nextNote);
    if (
      change.removedFileRefs.length > 0 ||
      change.removedSymbolRefs.length > 0
    ) {
      changes.push(change);
      if (!dryRun) {
        await writeCognitionNote(workspace, nextNote);
      }
    }
  }

  if (!dryRun && changes.length > 0) {
    // Exclude fully-orphaned notes from domain records — they are being archived
    await repairDomainRecords(
      workspace,
      nextNotes.filter((n) => n.referencesStatus !== 'stale'),
      maps,
    );
  }

  // Archive fully-orphaned notes (all refs dead) so they no longer appear in context
  const orphanedNotes = nextNotes.filter(
    (note) => note.referencesStatus === 'stale',
  );
  if (!dryRun) {
    for (const note of orphanedNotes) {
      await archiveOrphanedNote(workspace, note);
    }
  }
  const orphanedNoteCount = orphanedNotes.length;

  return {
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
