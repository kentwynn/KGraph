import { mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import {
  overwriteDomainRecord,
  readCognitionNotes,
  readDomainRecords,
  slugify,
  writeCognitionNote,
} from '../storage/cognition-store.js';
import { pathExists } from '../storage/kgraph-paths.js';
import { readMaps } from '../storage/map-store.js';
import type { CognitionNote, DomainRecord } from '../types/cognition.js';
import type { KGraphWorkspace } from '../types/config.js';
import type { ScanResult } from '../types/maps.js';
import { evaluateReferenceStatus } from './cognition-updater.js';

export interface CompactResult {
  merged: Array<{ targetId: string; sourceIds: string[]; title: string }>;
  archived: Array<{ id: string; title: string; reason: string }>;
}

export async function compactCognition(
  workspace: KGraphWorkspace,
  dryRun = false,
): Promise<CompactResult> {
  const notes = await readCognitionNotes(workspace);
  const maps = await readMaps(workspace);
  const groups = groupDuplicates(notes);
  const result: CompactResult = { merged: [], archived: [] };
  const consumed = new Set<string>();
  const archived = new Set<string>();
  const mergedNotes: CognitionNote[] = [];

  for (const group of groups.filter((items) => items.length > 1)) {
    const merged = mergeNotes(group, {
      files: maps.fileMap.files,
      symbols: maps.symbolMap.symbols,
    });
    const sourceIds = group.map((note) => note.id);
    result.merged.push({
      targetId: merged.id,
      sourceIds,
      title: merged.title,
    });
    sourceIds.forEach((id) => consumed.add(id));
    mergedNotes.push(merged);
    if (!dryRun) {
      await writeCognitionNote(workspace, merged);
      for (const note of group) {
        await archiveNote(workspace, note, `superseded-by-${merged.id}`);
      }
    }
  }

  for (const note of notes) {
    if (consumed.has(note.id)) continue;
    if (
      note.confidence === 'low' &&
      (note.referencesStatus === 'stale' || note.referencesStatus === 'unresolved')
    ) {
      result.archived.push({
        id: note.id,
        title: note.title,
        reason: 'low-confidence stale cognition',
      });
      archived.add(note.id);
      if (!dryRun) {
        await archiveNote(workspace, note, 'low-confidence-stale');
      }
    }
  }

  if (!dryRun && (consumed.size > 0 || archived.size > 0)) {
    const activeNotes = [
      ...notes.filter((note) => !consumed.has(note.id) && !archived.has(note.id)),
      ...mergedNotes,
    ];
    await rebuildDomainRecords(workspace, activeNotes, {
      files: maps.fileMap.files,
      symbols: maps.symbolMap.symbols,
    });
  }

  return result;
}

function groupDuplicates(notes: CognitionNote[]): CognitionNote[][] {
  const byKey = new Map<string, CognitionNote[]>();
  for (const note of notes) {
    if (note.supersededBy) continue;
    const key = [
      note.kind ?? 'summary',
      note.domain ?? 'general',
      normalizeTitle(note.title),
      normalizeText(note.summary ?? ''),
      stableList(note.relatedFiles),
      stableList(note.relatedSymbols),
    ].join('\0');
    const group = byKey.get(key) ?? [];
    group.push(note);
    byKey.set(key, group);
  }
  return [...byKey.values()];
}

function mergeNotes(
  notes: CognitionNote[],
  currentMaps: Pick<ScanResult, 'files' | 'symbols'>,
): CognitionNote {
  const sorted = [...notes].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
  const base = sorted[sorted.length - 1];
  const now = new Date().toISOString();
  const id = `${now.replace(/[:.]/g, '-')}-${slugify(base.title) || 'compacted'}`;
  const summaries = unique(
    sorted
      .map((note) => note.summary)
      .filter((summary): summary is string => Boolean(summary?.trim())),
  );
  const relatedFiles = unique(sorted.flatMap((note) => note.relatedFiles));
  const relatedSymbols = unique(sorted.flatMap((note) => note.relatedSymbols));
  return {
    ...base,
    id,
    source: 'compact',
    createdAt: now,
    updatedAt: now,
    supersedes: sorted.map((note) => note.id),
    supersededBy: undefined,
    confidence: highestConfidence(sorted.map((note) => note.confidence)),
    relatedFiles,
    relatedSymbols,
    tags: unique(sorted.flatMap((note) => note.tags)),
    summary: summaries[0] ?? base.summary,
    sections: {
      Summary: summaries.map((summary) => `- ${summary}`).join('\n'),
      'Compacted From': sorted.map((note) => `- ${note.id}`).join('\n'),
    },
    warnings: unique(sorted.flatMap((note) => note.warnings)),
    referencesStatus: evaluateReferenceStatus(
      relatedFiles,
      relatedSymbols,
      currentMaps,
    ),
  };
}

async function rebuildDomainRecords(
  workspace: KGraphWorkspace,
  notes: CognitionNote[],
  currentMaps: Pick<ScanResult, 'files' | 'symbols'>,
): Promise<void> {
  const existingDomains = await readDomainRecords(workspace);
  const existingByName = new Map(existingDomains.map((domain) => [domain.name, domain]));
  const domainNames = new Set([
    ...existingDomains.map((domain) => domain.name),
    ...notes.map((note) => note.domain ?? 'general'),
  ]);
  const fileSet = new Set(currentMaps.files.map((file) => file.path));
  const symbolSet = new Set(currentMaps.symbols.map((symbol) => symbol.name));

  for (const name of domainNames) {
    const relatedNotes = notes.filter((note) => (note.domain ?? 'general') === name);
    const existing = existingByName.get(name);
    const next: DomainRecord = {
      name,
      description: existing?.description,
      pathHints: unique(relatedNotes.flatMap((note) => note.relatedFiles)),
      tags: unique(relatedNotes.flatMap((note) => note.tags)),
      files: unique(
        relatedNotes
          .flatMap((note) => note.relatedFiles)
          .filter((file) => fileSet.has(file)),
      ),
      symbols: unique(
        relatedNotes
          .flatMap((note) => note.relatedSymbols)
          .filter((symbol) => symbolSet.has(symbol)),
      ),
      cognitionNotes: relatedNotes.map((note) => note.id),
    };
    await overwriteDomainRecord(workspace, next);
  }
}

async function archiveNote(
  workspace: KGraphWorkspace,
  note: CognitionNote,
  reason: string,
): Promise<void> {
  const source = path.join(workspace.cognitionPath, `${note.id}.md`);
  if (!(await pathExists(source))) return;
  const archivedDir = path.join(workspace.cognitionPath, 'archived');
  await mkdir(archivedDir, { recursive: true });
  await rename(source, path.join(archivedDir, `${reason}-${note.id}.md`));
}

function highestConfidence(values: Array<CognitionNote['confidence']>) {
  if (values.includes('high')) return 'high';
  if (values.includes('medium')) return 'medium';
  return 'low';
}

function normalizeTitle(value: string): string {
  return normalizeText(value);
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function stableList(values: string[]): string {
  return [...values].sort().join('\0');
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}
