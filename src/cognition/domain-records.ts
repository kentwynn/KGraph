import type { KGraphWorkspace } from '../types/config.js';
import type { CognitionNote, DomainRecord } from '../types/cognition.js';
import type { ScanResult } from '../types/maps.js';
import {
  overwriteDomainRecord,
  readDomainRecords,
} from '../storage/cognition-store.js';

export async function rebuildDomainRecords(
  workspace: KGraphWorkspace,
  notes: CognitionNote[],
  currentMaps: Pick<ScanResult, 'files' | 'symbols'>,
): Promise<void> {
  const existingDomains = await readDomainRecords(workspace);
  const existingByName = new Map(
    existingDomains.map((domain) => [domain.name, domain]),
  );
  const domainNames = new Set([
    ...existingDomains.map((domain) => domain.name),
    ...notes.map((note) => note.domain ?? 'general'),
  ]);
  const fileSet = new Set(currentMaps.files.map((file) => file.path));
  const symbolSet = new Set(currentMaps.symbols.map((symbol) => symbol.name));

  for (const name of domainNames) {
    const relatedNotes = notes.filter(
      (note) => (note.domain ?? 'general') === name,
    );
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

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}
