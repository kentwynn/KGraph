import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { KGraphError } from '../cli/errors.js';
import { getCurrentCommit } from '../scanner/git-utils.js';
import { readCognitionNotes } from '../storage/cognition-store.js';
import { pathExists } from '../storage/kgraph-paths.js';
import type { CognitionConfidence, CognitionNote } from '../types/cognition.js';
import type { KGraphWorkspace } from '../types/config.js';
import type {
  KnowledgeAtom,
  KnowledgeEvidenceRef,
  KnowledgeIndexes,
  KnowledgeSchema,
  KnowledgeValidationIssue,
} from '../types/knowledge.js';
import type { FileMap, SymbolMap } from '../types/maps.js';

export const KNOWLEDGE_SCHEMA_VERSION = 1;

export interface AtomInput {
  type: KnowledgeAtom['type'];
  topic: string;
  claim: string;
  summary?: string;
  confidence?: CognitionConfidence;
  files?: string[];
  symbols?: string[];
  domains?: string[];
  packages?: string[];
  sourceCommand: KnowledgeAtom['provenance']['sourceCommand'];
  agent?: string;
  sessionId?: string;
  commit?: string;
  createdAt?: string;
  idSeed?: string;
}

export interface AtomStatusRefreshResult {
  atoms: KnowledgeAtom[];
  updated: Array<{
    atomId: string;
    previousStatus: KnowledgeAtom['status'];
    nextStatus: KnowledgeAtom['status'];
    reasons: string[];
  }>;
}

export async function ensureKnowledgeStore(
  workspace: KGraphWorkspace,
): Promise<void> {
  await mkdir(indexesPath(workspace), { recursive: true });
  if (!(await pathExists(schemaPath(workspace)))) {
    const now = new Date().toISOString();
    await writeSchema(workspace, {
      version: KNOWLEDGE_SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
      migrations: [{ id: 'init-knowledge-v1', appliedAt: now }],
    });
  }
  if (!(await pathExists(atomsPath(workspace)))) {
    await atomicWriteFile(atomsPath(workspace), '');
  }
}

export async function readKnowledgeAtoms(
  workspace: KGraphWorkspace,
): Promise<KnowledgeAtom[]> {
  await migrateLegacyCognitionToAtoms(workspace);
  return readAtomsFile(workspace);
}

export async function readAtomsFile(
  workspace: KGraphWorkspace,
): Promise<KnowledgeAtom[]> {
  await ensureKnowledgeStore(workspace);
  const raw = await readFile(atomsPath(workspace), 'utf8');
  return parseAtomsJsonl(raw);
}

export function parseAtomsJsonl(raw: string): KnowledgeAtom[] {
  const atoms: KnowledgeAtom[] = [];
  for (const [index, line] of raw.split('\n').entries()) {
    if (!line.trim()) continue;
    try {
      atoms.push(JSON.parse(line) as KnowledgeAtom);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new KGraphError(`Invalid atoms.jsonl line ${index + 1}: ${message}`);
    }
  }
  return atoms;
}

export async function writeKnowledgeAtoms(
  workspace: KGraphWorkspace,
  atoms: KnowledgeAtom[],
): Promise<void> {
  await withKnowledgeWriteLock(workspace, () =>
    writeKnowledgeAtomsUnlocked(workspace, atoms),
  );
}

async function writeKnowledgeAtomsUnlocked(
  workspace: KGraphWorkspace,
  atoms: KnowledgeAtom[],
): Promise<void> {
  await ensureKnowledgeStore(workspace);
  await atomicWriteFile(
    atomsPath(workspace),
    atoms.map((atom) => JSON.stringify(atom)).join('\n') +
      (atoms.length > 0 ? '\n' : ''),
  );
  await writeKnowledgeIndexes(workspace, atoms);
  await touchSchema(workspace);
}

export async function appendKnowledgeAtom(
  workspace: KGraphWorkspace,
  atom: KnowledgeAtom,
): Promise<KnowledgeAtom> {
  await withKnowledgeWriteLock(workspace, async () => {
    const atoms = await readAtomsFile(workspace);
    atoms.push(atom);
    await writeKnowledgeAtomsUnlocked(workspace, atoms);
  });
  return atom;
}

export async function createKnowledgeAtom(
  workspace: KGraphWorkspace,
  input: AtomInput,
  maps?: { fileMap: FileMap; symbolMap: SymbolMap },
): Promise<KnowledgeAtom> {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const commit = input.commit ?? (await getCurrentCommit(workspace.rootPath)) ?? undefined;
  const evidenceRefs = buildEvidenceRefs(input, maps);
  const status = evaluateAtomStatus(evidenceRefs, maps);
  const atom: KnowledgeAtom = {
    id: buildAtomId(createdAt, input.idSeed ?? input.topic),
    type: input.type,
    topic: input.topic,
    claim: input.claim,
    summary: input.summary,
    confidence: computeConfidence(input.confidence ?? 'medium', status),
    status,
    evidenceRefs,
    scopeRefs: {
      files: input.files ?? [],
      symbols: input.symbols ?? [],
      domains: input.domains ?? [],
      packages: input.packages ?? [],
    },
    provenance: {
      sourceCommand: input.sourceCommand,
      agent: input.agent,
      sessionId: input.sessionId,
      commit,
      createdAt,
    },
    lifecycle: {
      supersedes: [],
    },
  };
  return appendKnowledgeAtom(workspace, atom);
}

export async function migrateLegacyCognitionToAtoms(
  workspace: KGraphWorkspace,
): Promise<void> {
  await ensureKnowledgeStore(workspace);
  const [existing, notes] = await Promise.all([
    readAtomsFile(workspace),
    readCognitionNotes(workspace),
  ]);
  const existingIds = new Set(existing.map((atom) => atom.id));
  const migrated: KnowledgeAtom[] = [];
  for (const note of notes) {
    const id = legacyAtomId(note);
    if (existingIds.has(id)) continue;
    if (
      existing.some(
        (atom) =>
          atom.topic === note.title &&
          atom.claim === (note.summary ?? note.title),
      )
    ) {
      continue;
    }
    migrated.push(legacyNoteToAtom(note, id));
  }
  if (migrated.length > 0) {
    await withKnowledgeWriteLock(workspace, async () => {
      const current = await readAtomsFile(workspace);
      const currentIds = new Set(current.map((atom) => atom.id));
      const nextMigrated = migrated.filter(
        (atom) =>
          !currentIds.has(atom.id) &&
          !current.some(
            (existing) =>
              existing.topic === atom.topic &&
              existing.claim === atom.claim,
          ),
      );
      if (nextMigrated.length > 0) {
        await writeKnowledgeAtomsUnlocked(workspace, [
          ...current,
          ...nextMigrated,
        ]);
      }
    });
  } else {
    await writeKnowledgeIndexes(workspace, existing);
  }
}

export async function updateKnowledgeAtom(
  workspace: KGraphWorkspace,
  atomId: string,
  updater: (atom: KnowledgeAtom) => KnowledgeAtom,
): Promise<KnowledgeAtom> {
  await migrateLegacyCognitionToAtoms(workspace);
  return withKnowledgeWriteLock(workspace, async () => {
    const atoms = await readAtomsFile(workspace);
    const index = atoms.findIndex((atom) => atom.id === atomId);
    if (index === -1) {
      throw new KGraphError(`Knowledge atom not found: ${atomId}`);
    }
    atoms[index] = updater(atoms[index]);
    await writeKnowledgeAtomsUnlocked(workspace, atoms);
    return atoms[index];
  });
}

export async function updateKnowledgeAtoms<T>(
  workspace: KGraphWorkspace,
  updater: (atoms: KnowledgeAtom[]) => { atoms: KnowledgeAtom[]; result: T },
): Promise<T> {
  await migrateLegacyCognitionToAtoms(workspace);
  return withKnowledgeWriteLock(workspace, async () => {
    const current = await readAtomsFile(workspace);
    const { atoms, result } = updater(current);
    await writeKnowledgeAtomsUnlocked(workspace, atoms);
    return result;
  });
}

export async function refreshKnowledgeAtomStatuses(
  workspace: KGraphWorkspace,
  maps: { fileMap: FileMap; symbolMap: SymbolMap },
  dryRun = false,
): Promise<AtomStatusRefreshResult> {
  const atoms = await readKnowledgeAtoms(workspace);
  const now = new Date().toISOString();
  const updated: AtomStatusRefreshResult['updated'] = [];
  const nextAtoms = atoms.map((atom) => {
    if (atom.status === 'archived') return atom;
    const health = evaluateAtomHealth(atom.evidenceRefs, maps);
    const nextConfidence = computeConfidence(atom.confidence, health.status, atom);
    const nextLifecycle: KnowledgeAtom['lifecycle'] = {
      ...atom.lifecycle,
      ...(health.reasons.length > 0 ? { invalidatedBy: health.reasons } : {}),
    };
    if (health.status === 'active') {
      delete nextLifecycle.invalidatedBy;
    }
    const statusChanged = health.status !== atom.status;
    const confidenceChanged = nextConfidence !== atom.confidence;
    const invalidationChanged =
      JSON.stringify(nextLifecycle.invalidatedBy ?? []) !==
      JSON.stringify(atom.lifecycle.invalidatedBy ?? []);
    const nextAtom: KnowledgeAtom = {
      ...atom,
      status: health.status,
      confidence: nextConfidence,
      lifecycle: nextLifecycle,
      provenance: {
        ...atom.provenance,
        ...(statusChanged || confidenceChanged || invalidationChanged
          ? { updatedAt: now }
          : {}),
      },
    };
    if (statusChanged || confidenceChanged || invalidationChanged) {
      updated.push({
        atomId: atom.id,
        previousStatus: atom.status,
        nextStatus: health.status,
        reasons: health.reasons,
      });
    }
    return nextAtom;
  });
  if (!dryRun && updated.length > 0) {
    await writeKnowledgeAtoms(workspace, nextAtoms);
  }
  return { atoms: nextAtoms, updated };
}

export async function validateKnowledgeStore(
  workspace: KGraphWorkspace,
  maps?: { fileMap: FileMap; symbolMap: SymbolMap },
): Promise<KnowledgeValidationIssue[]> {
  const issues: KnowledgeValidationIssue[] = [];
  if (!(await pathExists(schemaPath(workspace)))) {
    issues.push({ code: 'missing-schema', message: 'missing knowledge/schema.json' });
  } else {
    try {
      const schema = JSON.parse(await readFile(schemaPath(workspace), 'utf8')) as KnowledgeSchema;
      if (schema.version < KNOWLEDGE_SCHEMA_VERSION) {
        issues.push({
          code: 'old-schema',
          message: `knowledge schema ${schema.version} is older than ${KNOWLEDGE_SCHEMA_VERSION}`,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      issues.push({ code: 'missing-schema', message: `invalid knowledge schema: ${message}` });
    }
  }

  let atoms: KnowledgeAtom[] = [];
  try {
    atoms = await readKnowledgeAtoms(workspace);
  } catch (error) {
    issues.push({
      code: 'invalid-jsonl',
      message: error instanceof Error ? error.message : String(error),
    });
    return issues;
  }

  if (maps) {
    const fileByPath = new Map(maps.fileMap.files.map((file) => [file.path, file]));
    const symbolNames = new Set(maps.symbolMap.symbols.map((symbol) => symbol.name));
    const symbolIds = new Set(maps.symbolMap.symbols.map((symbol) => symbol.id));
    for (const atom of atoms) {
      if (atom.status === 'archived') continue;
      for (const ref of atom.evidenceRefs) {
        if (ref.type === 'file') {
          const file = fileByPath.get(ref.path);
          if (!file) {
            issues.push({
              code: 'broken-file-ref',
              atomId: atom.id,
              message: `${atom.id} references missing file ${ref.path}`,
            });
          } else if (ref.contentHash && ref.contentHash !== file.contentHash) {
            issues.push({
              code: 'stale-file-hash',
              atomId: atom.id,
              message: `${atom.id} references changed file ${ref.path}`,
            });
          }
        }
        if (ref.type === 'symbol') {
          const exists =
            (ref.symbolId && symbolIds.has(ref.symbolId)) ||
            symbolNames.has(ref.name);
          if (!exists) {
            issues.push({
              code: 'broken-symbol-ref',
              atomId: atom.id,
              message: `${atom.id} references missing symbol ${ref.name}`,
            });
          }
        }
      }
    }
  }
  return issues;
}

export function atomToCognitionNote(atom: KnowledgeAtom): CognitionNote {
  return {
    id: atom.id,
    title: atom.topic,
    kind: atom.type,
    confidence: atom.confidence,
    domain: atom.scopeRefs.domains[0],
    tags: [],
    summary: atom.summary ?? atom.claim,
    sections: { Summary: atom.summary ?? atom.claim },
    relatedFiles: atom.scopeRefs.files,
    relatedSymbols: atom.scopeRefs.symbols,
    warnings: [],
    sourceInboxPath: '',
    processedPath: '',
    createdAt: atom.provenance.createdAt,
    updatedAt: atom.provenance.updatedAt,
    source:
      atom.provenance.sourceCommand === 'legacy-migration' ||
      atom.provenance.sourceCommand === 'update'
        ? 'inbox'
        : atom.provenance.sourceCommand,
    supersedes: atom.lifecycle.supersedes,
    supersededBy: atom.lifecycle.supersededBy,
    referencesStatus:
      atom.status === 'active'
        ? 'current'
        : atom.status === 'needs-review'
          ? 'mixed'
          : atom.status === 'stale'
            ? 'stale'
            : 'unresolved',
  };
}

export function knowledgePaths(workspace: KGraphWorkspace): {
  atoms: string;
  schema: string;
  indexes: string;
  terms: string;
  refs: string;
  topics: string;
} {
  return {
    atoms: atomsPath(workspace),
    schema: schemaPath(workspace),
    indexes: indexesPath(workspace),
    terms: path.join(indexesPath(workspace), 'terms.json'),
    refs: path.join(indexesPath(workspace), 'refs.json'),
    topics: path.join(indexesPath(workspace), 'topics.json'),
  };
}

function buildEvidenceRefs(
  input: AtomInput,
  maps?: { fileMap: FileMap; symbolMap: SymbolMap },
): KnowledgeEvidenceRef[] {
  const fileByPath = new Map(maps?.fileMap.files.map((file) => [file.path, file]) ?? []);
  const symbolsByName = new Map(
    maps?.symbolMap.symbols.map((symbol) => [symbol.name, symbol]) ?? [],
  );
  const refs: KnowledgeEvidenceRef[] = [];
  for (const filePath of input.files ?? []) {
    const file = fileByPath.get(filePath);
    refs.push({
      type: 'file',
      path: filePath,
      ...(file?.contentHash ? { contentHash: file.contentHash } : {}),
    });
  }
  for (const name of input.symbols ?? []) {
    const symbol = symbolsByName.get(name);
    refs.push({
      type: 'symbol',
      name,
      ...(symbol?.filePath ? { filePath: symbol.filePath } : {}),
      ...(symbol?.id ? { symbolId: symbol.id } : {}),
      ...(symbol?.startLine ? { startLine: symbol.startLine } : {}),
      ...(symbol?.endLine ? { endLine: symbol.endLine } : {}),
    });
  }
  if (input.commit) {
    refs.push({ type: 'git', commit: input.commit });
  }
  if (input.sessionId || input.agent) {
    refs.push({ type: 'session', sessionId: input.sessionId, agent: input.agent });
  }
  return refs;
}

function evaluateAtomStatus(
  refs: KnowledgeEvidenceRef[],
  maps?: { fileMap: FileMap; symbolMap: SymbolMap },
): KnowledgeAtom['status'] {
  return evaluateAtomHealth(refs, maps).status;
}

function evaluateAtomHealth(
  refs: KnowledgeEvidenceRef[],
  maps?: { fileMap: FileMap; symbolMap: SymbolMap },
): { status: KnowledgeAtom['status']; reasons: string[] } {
  if (!maps || refs.length === 0) return { status: 'active', reasons: [] };
  const fileByPath = new Map(maps.fileMap.files.map((file) => [file.path, file]));
  const symbolNames = new Set(maps.symbolMap.symbols.map((symbol) => symbol.name));
  const symbolIds = new Set(maps.symbolMap.symbols.map((symbol) => symbol.id));
  let stale = false;
  let needsReview = false;
  const reasons: string[] = [];
  for (const ref of refs) {
    if (ref.type === 'file') {
      const file = fileByPath.get(ref.path);
      if (!file) {
        stale = true;
        reasons.push(`missing file:${ref.path}`);
      } else if (ref.contentHash && ref.contentHash !== file.contentHash) {
        needsReview = true;
        reasons.push(`changed file:${ref.path}`);
      }
    }
    if (ref.type === 'symbol') {
      const exists =
        (ref.symbolId && symbolIds.has(ref.symbolId)) || symbolNames.has(ref.name);
      if (!exists) {
        stale = true;
        reasons.push(`missing symbol:${ref.name}`);
      }
    }
  }
  if (stale) return { status: 'stale', reasons };
  if (needsReview) return { status: 'needs-review', reasons };
  return { status: 'active', reasons };
}

function computeConfidence(
  initial: CognitionConfidence,
  status: KnowledgeAtom['status'],
  atom?: KnowledgeAtom,
): CognitionConfidence {
  if (atom?.lifecycle.supersededBy || atom?.status === 'archived') return 'low';
  if (status === 'stale') return 'low';
  if (status === 'needs-review' && initial === 'high') return 'medium';
  if (atom?.provenance.sourceCommand === 'legacy-migration' && initial === 'high') {
    return 'medium';
  }
  return initial;
}

function legacyNoteToAtom(note: CognitionNote, id: string): KnowledgeAtom {
  return {
    id,
    type: note.kind,
    topic: note.title,
    claim: note.summary ?? note.title,
    summary: note.summary,
    confidence: note.confidence,
    status:
      note.referencesStatus === 'current'
        ? 'active'
        : note.referencesStatus === 'mixed'
          ? 'needs-review'
          : note.referencesStatus === 'stale'
            ? 'stale'
            : 'needs-review',
    evidenceRefs: [
      ...note.relatedFiles.map((file): KnowledgeEvidenceRef => ({ type: 'file', path: file })),
      ...note.relatedSymbols.map((symbol): KnowledgeEvidenceRef => ({
        type: 'symbol',
        name: symbol,
      })),
    ],
    scopeRefs: {
      files: note.relatedFiles,
      symbols: note.relatedSymbols,
      domains: note.domain ? [note.domain] : [],
      packages: [],
    },
    provenance: {
      sourceCommand: 'legacy-migration',
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    },
    lifecycle: {
      supersedes: note.supersedes ?? [],
      supersededBy: note.supersededBy,
    },
  };
}

function legacyAtomId(note: CognitionNote): string {
  return `legacy-${note.id}`;
}

async function writeKnowledgeIndexes(
  workspace: KGraphWorkspace,
  atoms: KnowledgeAtom[],
): Promise<void> {
  await mkdir(indexesPath(workspace), { recursive: true });
  const indexes = buildIndexes(atoms);
  await Promise.all([
    atomicWriteFile(path.join(indexesPath(workspace), 'terms.json'), JSON.stringify(indexes.terms, null, 2) + '\n'),
    atomicWriteFile(path.join(indexesPath(workspace), 'refs.json'), JSON.stringify(indexes.refs, null, 2) + '\n'),
    atomicWriteFile(path.join(indexesPath(workspace), 'topics.json'), JSON.stringify(indexes.topics, null, 2) + '\n'),
  ]);
}

function buildIndexes(atoms: KnowledgeAtom[]): KnowledgeIndexes {
  const terms: Record<string, string[]> = {};
  const refs: Record<string, string[]> = {};
  const topics: Record<string, string[]> = {};
  for (const atom of atoms.filter((item) => item.status !== 'archived')) {
    for (const term of tokenize([atom.topic, atom.claim, atom.summary ?? ''].join(' '))) {
      addIndex(terms, term, atom.id);
    }
    addIndex(topics, atom.topic.toLowerCase(), atom.id);
    for (const file of atom.scopeRefs.files) addIndex(refs, `file:${file}`, atom.id);
    for (const symbol of atom.scopeRefs.symbols) addIndex(refs, `symbol:${symbol}`, atom.id);
  }
  return { terms, refs, topics };
}

function addIndex(index: Record<string, string[]>, key: string, atomId: string): void {
  const values = index[key] ?? [];
  if (!values.includes(atomId)) values.push(atomId);
  index[key] = values;
}

async function touchSchema(workspace: KGraphWorkspace): Promise<void> {
  const schema = await readSchema(workspace);
  await writeSchema(workspace, {
    ...schema,
    updatedAt: new Date().toISOString(),
  });
}

async function readSchema(workspace: KGraphWorkspace): Promise<KnowledgeSchema> {
  await ensureKnowledgeStore(workspace);
  return JSON.parse(await readFile(schemaPath(workspace), 'utf8')) as KnowledgeSchema;
}

async function writeSchema(
  workspace: KGraphWorkspace,
  schema: KnowledgeSchema,
): Promise<void> {
  await mkdir(workspace.knowledgePath, { recursive: true });
  await atomicWriteFile(schemaPath(workspace), JSON.stringify(schema, null, 2) + '\n');
}

function buildAtomId(createdAt: string, seed: string): string {
  return `${createdAt.replace(/[:.]/g, '-')}-${slugify(seed) || 'atom'}`;
}

function tokenize(value: string): string[] {
  return [
    ...new Set(
      value
        .toLowerCase()
        .split(/[^a-z0-9_$./-]+/)
        .map((token) => token.trim())
        .filter((token) => token.length > 1),
    ),
  ];
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function atomsPath(workspace: KGraphWorkspace): string {
  return path.join(workspace.knowledgePath, 'atoms.jsonl');
}

function schemaPath(workspace: KGraphWorkspace): string {
  return path.join(workspace.knowledgePath, 'schema.json');
}

function indexesPath(workspace: KGraphWorkspace): string {
  return path.join(workspace.knowledgePath, 'indexes');
}

async function atomicWriteFile(targetPath: string, content: string): Promise<void> {
  await mkdir(path.dirname(targetPath), { recursive: true });
  const tempPath = path.join(
    path.dirname(targetPath),
    `.${path.basename(targetPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  await writeFile(tempPath, content, 'utf8');
  await rename(tempPath, targetPath);
}

async function withKnowledgeWriteLock<T>(
  workspace: KGraphWorkspace,
  operation: () => Promise<T>,
): Promise<T> {
  await mkdir(workspace.knowledgePath, { recursive: true });
  const lockPath = path.join(workspace.knowledgePath, '.write.lock');
  const startedAt = Date.now();
  while (true) {
    try {
      await mkdir(lockPath);
      break;
    } catch (error) {
      if (Date.now() - startedAt > 10_000) {
        throw new KGraphError('Timed out waiting for KGraph knowledge write lock.');
      }
      await delay(50);
    }
  }
  try {
    return await operation();
  } finally {
    await rm(lockPath, { recursive: true, force: true });
  }
}
