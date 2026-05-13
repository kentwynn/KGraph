import { readMaps } from '../storage/map-store.js';
import { slugify, writeCognitionNote, writeDomainRecord } from '../storage/cognition-store.js';
import { KGraphError } from '../cli/errors.js';
import { createKnowledgeAtom } from '../knowledge/atom-store.js';
import type {
  CognitionConfidence,
  CognitionKind,
  CognitionNote,
  CognitionSource,
} from '../types/cognition.js';
import type { KGraphWorkspace } from '../types/config.js';
import type { ScanResult } from '../types/maps.js';
import { evaluateReferenceStatus } from './cognition-updater.js';
import { readSessionState } from '../session/session-store.js';

export interface ConclusionInput {
  topic: string;
  body?: string;
  kind?: CognitionKind;
  confidence?: CognitionConfidence;
  domain?: string;
  tags?: string[];
  relatedFiles?: string[];
  relatedSymbols?: string[];
  source: CognitionSource;
  agent?: string;
  sessionId?: string;
}

export async function concludeTopic(
  workspace: KGraphWorkspace,
  input: ConclusionInput,
): Promise<CognitionNote> {
  const maps = await readMaps(workspace);
  const now = new Date().toISOString();
  const timestamp = now.replace(/[:.]/g, '-');
  const title = input.topic.trim();
  const summary = normalizeBody(input.body) ?? title;
  const note: CognitionNote = {
    title,
    kind: input.kind ?? 'summary',
    confidence: input.confidence ?? 'medium',
    domain: input.domain,
    tags: input.tags ?? [],
    summary,
    sections: {
      Summary: summary,
      ...(input.relatedFiles?.length ? { 'Related Files': input.relatedFiles.map((file) => `- ${file}`).join('\n') } : {}),
      ...(input.relatedSymbols?.length ? { 'Key Symbols': input.relatedSymbols.map((symbol) => `- \`${symbol}\``).join('\n') } : {}),
    },
    relatedFiles: input.relatedFiles ?? [],
    relatedSymbols: input.relatedSymbols ?? [],
    warnings: [],
    id: `${timestamp}-${slugify(title) || 'conclusion'}`,
    sourceInboxPath: '',
    processedPath: `.kgraph/cognition/${timestamp}-${slugify(title) || 'conclusion'}.md`,
    createdAt: now,
    source: input.source,
    referencesStatus: evaluateReferenceStatus(
      input.relatedFiles ?? [],
      input.relatedSymbols ?? [],
      { files: maps.fileMap.files, symbols: maps.symbolMap.symbols },
    ),
  };

  await writeCognitionNote(workspace, note);
  await writeDomainRecord(workspace, toDomainRecord(note, {
    files: maps.fileMap.files,
    symbols: maps.symbolMap.symbols,
  }));
  await createKnowledgeAtom(
    workspace,
    {
      type: note.kind,
      topic: note.title,
      claim: note.summary ?? note.title,
      summary: note.summary,
      confidence: note.confidence,
      files: note.relatedFiles,
      symbols: note.relatedSymbols,
      domains: note.domain ? [note.domain] : [],
      sourceCommand:
        input.source === 'session-conclude'
          ? 'session-conclude'
          : input.source === 'compact'
            ? 'compact'
            : 'conclude',
      agent: input.agent,
      sessionId: input.sessionId,
      createdAt: note.createdAt,
      idSeed: note.id,
    },
    maps,
  );
  return note;
}

export async function concludeActiveSession(
  workspace: KGraphWorkspace,
  agent: string,
  input: Omit<ConclusionInput, 'source' | 'relatedFiles' | 'relatedSymbols'>,
): Promise<CognitionNote> {
  return concludeTopic(
    workspace,
    await buildActiveSessionConclusion(workspace, agent, input),
  );
}

export async function buildActiveSessionConclusion(
  workspace: KGraphWorkspace,
  agent: string,
  input: Omit<ConclusionInput, 'source' | 'relatedFiles' | 'relatedSymbols'>,
): Promise<ConclusionInput> {
  const state = await readSessionState(workspace);
  const active = state.active[agent];
  if (!active) {
    throw new KGraphError(`No active session for agent "${agent}".`);
  }
  const events = state.events.filter(
    (event) => event.agent === agent && event.timestamp >= active.startedAt,
  );
  const touchedFiles = [
    ...new Set(
      events
        .filter((event) => event.type === 'read' || event.type === 'write')
        .map((event) => event.path)
        .filter((file): file is string => Boolean(file)),
    ),
  ];
  const writtenFiles = [
    ...new Set(
      events
        .filter((event) => event.type === 'write')
        .map((event) => event.path)
        .filter((file): file is string => Boolean(file)),
    ),
  ];
  const body = [
    normalizeBody(input.body) ?? `Session concluded for ${input.topic}.`,
    touchedFiles.length
      ? `Touched files: ${touchedFiles.join(', ')}.`
      : undefined,
    writtenFiles.length
      ? `Changed files: ${writtenFiles.join(', ')}.`
      : undefined,
  ]
    .filter(Boolean)
    .join('\n\n');
  return {
    ...input,
    body,
    source: 'session-conclude',
    relatedFiles: touchedFiles,
    agent,
    sessionId: active.sessionId,
  };
}

function normalizeBody(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toDomainRecord(
  note: CognitionNote,
  currentMaps: Pick<ScanResult, 'files' | 'symbols'>,
) {
  const fileSet = new Set(currentMaps.files.map((file) => file.path));
  const symbolSet = new Set(currentMaps.symbols.map((symbol) => symbol.name));
  return {
    name: note.domain ?? 'general',
    pathHints: note.relatedFiles,
    tags: note.tags,
    files: note.relatedFiles.filter((file) => fileSet.has(file)),
    symbols: note.relatedSymbols.filter((symbol) => symbolSet.has(symbol)),
    cognitionNotes: [note.id],
  };
}
