import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  archiveInboxNote,
  listInboxNotes,
  readCognitionNotes,
  slugify,
  writeCognitionNote,
  writeDomainRecord,
} from '../storage/cognition-store.js';
import type {
  CognitionNote,
  DomainRecord,
  ReferenceStatus,
} from '../types/cognition.js';
import type { KGraphWorkspace } from '../types/config.js';
import type { ScanResult } from '../types/maps.js';
import { parseMarkdownNote } from './markdown-note-parser.js';

export interface UpdateResult {
  processed: CognitionNote[];
  warnings: string[];
}

export async function updateCognition(
  workspace: KGraphWorkspace,
  currentMaps: Pick<ScanResult, 'files' | 'symbols'>,
  dryRun = false,
): Promise<UpdateResult> {
  const inboxNotes = await listInboxNotes(workspace);
  const processed: CognitionNote[] = [];
  const warnings: string[] = [];

  for (const inboxPath of inboxNotes) {
    try {
      const raw = await readFile(inboxPath, 'utf8');
      const parsed = parseMarkdownNote(raw);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      // Always include the inbox basename as a per-note unique suffix so two notes with
      // the same title processed in the same millisecond never receive the same ID.
      const base = path.basename(inboxPath, '.md');
      const slug = slugify(parsed.title);
      const id = slug ? `${timestamp}-${slug}-${base}` : `${timestamp}-${base}`;
      const archivedPath = path.join(
        workspace.processedInteractionsPath,
        `${timestamp}-${path.basename(inboxPath)}`,
      );
      const note: CognitionNote = {
        ...parsed,
        id,
        sourceInboxPath: path
          .relative(workspace.rootPath, inboxPath)
          .split(path.sep)
          .join('/'),
        processedPath: path
          .relative(workspace.rootPath, archivedPath)
          .split(path.sep)
          .join('/'),
        createdAt: new Date().toISOString(),
        referencesStatus: evaluateReferenceStatus(
          parsed.relatedFiles,
          parsed.relatedSymbols,
          currentMaps,
        ),
      };

      processed.push(note);
      warnings.push(
        ...parsed.warnings.map(
          (warning) => `${path.basename(inboxPath)}: ${warning}`,
        ),
      );

      if (!dryRun) {
        await archiveInboxNote(workspace, inboxPath, timestamp);
        await writeCognitionNote(workspace, note);
        await writeDomainRecord(workspace, toDomainRecord(note, currentMaps));
      }
    } catch (error) {
      warnings.push(
        `${path.basename(inboxPath)}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Refresh reference statuses on all existing notes so that notes which
  // became stale since the last scan reflect the current map state.
  if (!dryRun) {
    await refreshCognitionReferenceStatuses(workspace, currentMaps);
  }

  return { processed, warnings };
}

export async function refreshCognitionReferenceStatuses(
  workspace: KGraphWorkspace,
  currentMaps: Pick<ScanResult, 'files' | 'symbols'>,
): Promise<void> {
  const notes = await readCognitionNotes(workspace);
  for (const note of notes) {
    // Re-parse relatedSymbols from the archived raw markdown if available.
    // This migrates old notes that were parsed with the old plain-text heuristic
    // (which produced false positives like JWT, CSRF, TODO) to the current
    // backtick-only logic.
    let relatedSymbols = note.relatedSymbols;
    if (note.processedPath) {
      try {
        const raw = await readFile(
          path.join(workspace.rootPath, note.processedPath),
          'utf8',
        );
        relatedSymbols = parseMarkdownNote(raw).relatedSymbols;
      } catch {
        // archived file missing — keep stored symbols
      }
    }

    const nextStatus = evaluateReferenceStatus(
      note.relatedFiles,
      relatedSymbols,
      currentMaps,
    );
    if (
      nextStatus !== note.referencesStatus ||
      relatedSymbols !== note.relatedSymbols
    ) {
      await writeCognitionNote(workspace, {
        ...note,
        relatedSymbols,
        referencesStatus: nextStatus,
      });
    }
  }
}

export function evaluateReferenceStatus(
  relatedFiles: string[],
  relatedSymbols: string[],
  currentMaps: Pick<ScanResult, 'files' | 'symbols'>,
): ReferenceStatus {
  const filePaths = new Set(currentMaps.files.map((file) => file.path));
  const symbolNames = new Set(currentMaps.symbols.map((symbol) => symbol.name));
  const references = [
    ...relatedFiles.map((file) => filePaths.has(file)),
    ...relatedSymbols.map((symbol) => symbolNames.has(symbol)),
  ];

  if (references.length === 0) {
    return 'unresolved';
  }
  if (references.every(Boolean)) {
    return 'current';
  }
  if (references.every((value) => !value)) {
    return 'stale';
  }
  return 'mixed';
}

function toDomainRecord(
  note: CognitionNote,
  currentMaps: Pick<ScanResult, 'files' | 'symbols'>,
): DomainRecord {
  const name = note.domain ?? 'general';
  const fileSet = new Set(currentMaps.files.map((file) => file.path));
  const symbolSet = new Set(currentMaps.symbols.map((symbol) => symbol.name));
  return {
    name,
    pathHints: note.relatedFiles,
    tags: note.tags,
    files: note.relatedFiles.filter((file) => fileSet.has(file)),
    symbols: note.relatedSymbols.filter((symbol) => symbolSet.has(symbol)),
    cognitionNotes: [note.id],
  };
}
