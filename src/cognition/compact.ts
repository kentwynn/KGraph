import { mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import {
  atomToCognitionNote,
  readKnowledgeAtoms,
  refreshKnowledgeAtomStatuses,
  writeKnowledgeAtoms,
} from '../knowledge/atom-store.js';
import { rebuildDomainRecords } from './domain-records.js';
import {
  readCognitionNotes,
  slugify,
  writeCognitionNote,
} from '../storage/cognition-store.js';
import { pathExists } from '../storage/kgraph-paths.js';
import { readMaps } from '../storage/map-store.js';
import type { CognitionNote } from '../types/cognition.js';
import type { KGraphWorkspace } from '../types/config.js';
import type { KnowledgeAtom } from '../types/knowledge.js';
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
  const maps = await readMaps(workspace);
  const refreshed = await refreshKnowledgeAtomStatuses(
    workspace,
    { fileMap: maps.fileMap, symbolMap: maps.symbolMap },
    dryRun,
  );
  const atoms = refreshed.atoms;
  const groups = groupDuplicateAtoms(atoms);
  const result: CompactResult = { merged: [], archived: [] };
  const consumed = new Set<string>();
  const archived = new Set<string>();
  const mergedAtoms: KnowledgeAtom[] = [];

  for (const group of groups.filter((items) => items.length > 1)) {
    const merged = mergeAtoms(group, {
      files: maps.fileMap.files,
      symbols: maps.symbolMap.symbols,
    });
    const sourceIds = group.map((atom) => atom.id);
    result.merged.push({
      targetId: merged.id,
      sourceIds,
      title: merged.topic,
    });
    sourceIds.forEach((id) => consumed.add(id));
    mergedAtoms.push(merged);
  }

  for (const atom of atoms) {
    if (consumed.has(atom.id) || atom.status === 'archived') continue;
    if (
      atom.confidence === 'low' &&
      (atom.status === 'stale' || atom.status === 'needs-review')
    ) {
      result.archived.push({
        id: atom.id,
        title: atom.topic,
        reason: `low-confidence ${atom.status} atom`,
      });
      archived.add(atom.id);
    }
  }

  if (!dryRun && (consumed.size > 0 || archived.size > 0)) {
    const now = new Date().toISOString();
    const nextAtoms = [
      ...atoms.map((atom) => {
        if (consumed.has(atom.id)) {
          const merged = mergedAtoms.find((candidate) =>
            candidate.lifecycle.supersedes.includes(atom.id),
          );
          return {
            ...atom,
            status: 'archived' as const,
            confidence: 'low' as const,
            lifecycle: {
              ...atom.lifecycle,
              supersededBy: merged?.id,
              archivedAt: now,
            },
            provenance: { ...atom.provenance, updatedAt: now },
          };
        }
        if (archived.has(atom.id)) {
          return {
            ...atom,
            status: 'archived' as const,
            lifecycle: { ...atom.lifecycle, archivedAt: now },
            provenance: { ...atom.provenance, updatedAt: now },
          };
        }
        return atom;
      }),
      ...mergedAtoms,
    ];
    await writeKnowledgeAtoms(workspace, nextAtoms);
    for (const atom of [...atoms.filter((item) => consumed.has(item.id) || archived.has(item.id)), ...mergedAtoms]) {
      const note = atomToCognitionNote(atom);
      if (mergedAtoms.some((merged) => merged.id === atom.id)) {
        await writeCognitionNote(workspace, note);
      } else {
        await archiveNote(workspace, note, consumed.has(atom.id) ? `superseded-by-${note.supersededBy ?? 'compact'}` : 'low-confidence-stale');
      }
    }
    const activeNotes = nextAtoms
      .filter((atom) => atom.status !== 'archived')
      .map(atomToCognitionNote);
    await rebuildDomainRecords(workspace, activeNotes, {
      files: maps.fileMap.files,
      symbols: maps.symbolMap.symbols,
    });
  }

  return result;
}

function groupDuplicateAtoms(atoms: KnowledgeAtom[]): KnowledgeAtom[][] {
  const byKey = new Map<string, KnowledgeAtom[]>();
  for (const atom of atoms) {
    if (atom.status === 'archived' || atom.lifecycle.supersededBy) continue;
    const key = [
      atom.type,
      atom.scopeRefs.domains[0] ?? 'general',
      normalizeText(atom.topic),
      normalizeText(atom.claim),
      stableList(atom.scopeRefs.files),
      stableList(atom.scopeRefs.symbols),
    ].join('\0');
    const group = byKey.get(key) ?? [];
    group.push(atom);
    byKey.set(key, group);
  }
  return [...byKey.values()];
}

function mergeAtoms(
  atoms: KnowledgeAtom[],
  currentMaps: Pick<ScanResult, 'files' | 'symbols'>,
): KnowledgeAtom {
  const sorted = [...atoms].sort((left, right) =>
    left.provenance.createdAt.localeCompare(right.provenance.createdAt),
  );
  const base = sorted[sorted.length - 1];
  const now = new Date().toISOString();
  const id = `${now.replace(/[:.]/g, '-')}-${slugify(base.topic) || 'compacted'}`;
  const summaries = unique(
    sorted
      .map((atom) => atom.summary ?? atom.claim)
      .filter((summary): summary is string => Boolean(summary?.trim())),
  );
  const files = unique(sorted.flatMap((atom) => atom.scopeRefs.files));
  const symbols = unique(sorted.flatMap((atom) => atom.scopeRefs.symbols));
  const domains = unique(sorted.flatMap((atom) => atom.scopeRefs.domains));
  const packages = unique(sorted.flatMap((atom) => atom.scopeRefs.packages));
  const status = atomStatusFromReferenceStatus(
    evaluateReferenceStatus(files, symbols, currentMaps),
  );
  return {
    ...base,
    id,
    claim: summaries[0] ?? base.claim,
    summary: summaries.join('\n'),
    confidence: highestConfidence(sorted.map((atom) => atom.confidence)),
    status,
    evidenceRefs: uniqueEvidence(sorted.flatMap((atom) => atom.evidenceRefs)),
    scopeRefs: { files, symbols, domains, packages },
    provenance: {
      sourceCommand: 'compact',
      agent: base.provenance.agent,
      sessionId: base.provenance.sessionId,
      commit: base.provenance.commit,
      createdAt: now,
    },
    lifecycle: {
      supersedes: sorted.map((atom) => atom.id),
    },
  };
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

function atomStatusFromReferenceStatus(
  status: CognitionNote['referencesStatus'],
): KnowledgeAtom['status'] {
  if (status === 'current') return 'active';
  if (status === 'mixed') return 'needs-review';
  return 'stale';
}

function uniqueEvidence(items: KnowledgeAtom['evidenceRefs']): KnowledgeAtom['evidenceRefs'] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
