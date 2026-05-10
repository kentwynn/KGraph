import {
  overwriteDomainRecord,
  readCognitionNotes,
  readDomainRecords,
  writeCognitionNote,
} from '../storage/cognition-store.js';
import type { KGraphWorkspace } from '../types/config.js';
import type {
  CognitionNote,
  DomainRecord,
  ReferenceStatus,
} from '../types/cognition.js';
import type { FileMap, SymbolMap } from '../types/maps.js';

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
  changes: CognitionRepairChange[];
}

export async function analyzeCognitionQuality(
  workspace: KGraphWorkspace,
  maps: { fileMap: FileMap; symbolMap: SymbolMap },
): Promise<CognitionQualityReport> {
  const notes = await readCognitionNotes(workspace);
  const changes = notes
    .map((note) => analyzeNote(note, maps))
    .filter(
      (change) =>
        change.removedFileRefs.length > 0 ||
        change.removedSymbolRefs.length > 0,
    );

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
    changes,
  };
}

export async function repairCognition(
  workspace: KGraphWorkspace,
  maps: { fileMap: FileMap; symbolMap: SymbolMap },
  dryRun = false,
): Promise<CognitionQualityReport> {
  const notes = await readCognitionNotes(workspace);
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
    await repairDomainRecords(workspace, nextNotes, maps);
  }

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
    changes,
  };
}

function analyzeNote(
  note: CognitionNote,
  maps: { fileMap: FileMap; symbolMap: SymbolMap },
): CognitionRepairChange {
  const filePaths = new Set(maps.fileMap.files.map((file) => file.path));
  const symbolNames = new Set(maps.symbolMap.symbols.map((symbol) => symbol.name));
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
  const symbolNames = new Set(maps.symbolMap.symbols.map((symbol) => symbol.name));
  const notesById = new Map(notes.map((note) => [note.id, note]));

  for (const domain of domains) {
    const relatedNotes = domain.cognitionNotes
      .map((id) => notesById.get(id))
      .filter((note): note is CognitionNote => Boolean(note));
    const next: DomainRecord = {
      ...domain,
      pathHints: unique(
        relatedNotes.flatMap((note) => note.relatedFiles),
      ),
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
  const symbolNames = new Set(maps.symbolMap.symbols.map((symbol) => symbol.name));
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
  return !ref.includes('/') && /^[A-Z][A-Za-z0-9_-]*\.[A-Za-z0-9_-]+$/.test(ref);
}

function isNoisySymbolRef(ref: string): boolean {
  return /^[a-z][A-Za-z0-9_$]*$/.test(ref);
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}
