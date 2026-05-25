import {
  refreshCognitionReferenceStatuses,
  updateCognition,
} from '../../cognition/cognition-updater.js';
import { concludeTopic } from '../../cognition/conclusion.js';
import { loadConfig } from '../../config/config.js';
import { queryContext } from '../../context/context-query.js';
import { refreshKnowledgeAtomStatuses } from '../../knowledge/atom-store.js';
import { getWorkingTreeChanges } from '../../scanner/git-utils.js';
import { shouldExclude } from '../../scanner/file-classifier.js';
import { scanRepository } from '../../scanner/repo-scanner.js';
import {
  assertSessionAgent,
  recordSessionEvent,
} from '../../session/session-store.js';
import { listInboxNotes } from '../../storage/cognition-store.js';
import {
  assertWorkspace,
  pathExists,
  resolveWorkspace,
} from '../../storage/kgraph-paths.js';
import { readMaps, writeMaps } from '../../storage/map-store.js';
import type { KnowledgeAtom } from '../../types/knowledge.js';
import type { RepositoryFile } from '../../types/maps.js';
import { KGraphError, runCommand } from '../errors.js';
import { renderRootHelp, renderWorkflowBanner } from '../help.js';
import { normalizeConfidence, normalizeKind } from './conclude.js';
import { renderContextMarkdown } from './context.js';

export interface DefaultWorkflowOptions {
  final?: boolean;
  capture?: string;
  type?: string;
  confidence?: string;
  domain?: string;
  tags?: string[];
  files?: string[];
  symbols?: string[];
  agent?: string;
}

export async function runDefaultWorkflow(
  query?: string,
  options: DefaultWorkflowOptions = {},
): Promise<void> {
  await runCommand(async () => {
    const topic = query?.trim();
    const candidateWorkspace = resolveWorkspace(process.cwd());
    if (!topic && !(await pathExists(candidateWorkspace.kgraphPath))) {
      console.log(renderRootHelp());
      return;
    }

    const workspace = await assertWorkspace(process.cwd());
    const config = await loadConfig(workspace);
    const sessionAgent = options.agent
      ? assertSessionAgent(options.agent)
      : undefined;
    if (sessionAgent) {
      await recordSessionEvent(workspace, {
        agent: sessionAgent,
        type: 'context',
        captureSource: 'automatic',
      });
    }
    const previousMaps = await readMaps(workspace);
    const scan = await scanRepository(workspace.rootPath, config, {
      files: previousMaps.fileMap.files,
      symbols: previousMaps.symbolMap.symbols,
      dependencies: previousMaps.dependencyMap.dependencies,
      relationships: previousMaps.relationshipMap.relationships,
      warnings: [],
      scannedAtCommit: previousMaps.fileMap.scannedAtCommit,
    });

    await writeMaps(workspace, scan);
    await refreshCognitionReferenceStatuses(workspace, {
      files: scan.files,
      symbols: scan.symbols,
    });

    const update = await updateCognition(
      workspace,
      { files: scan.files, symbols: scan.symbols },
      false,
    );

    if (options.capture) {
      if (!topic) {
        throw new KGraphError('A topic is required when using --capture.');
      }
      const note = await concludeTopic(workspace, {
        topic,
        body: options.capture,
        kind: normalizeKind(options.type),
        confidence: normalizeConfidence(options.confidence),
        domain: options.domain,
        tags: options.tags ?? [],
        relatedFiles: options.files ?? [],
        relatedSymbols: options.symbols ?? [],
        source: 'conclude',
      });
      console.log(`Stored ${note.kind} cognition: ${note.title}`);
      console.log(`Confidence: ${note.confidence}`);
      console.log(`Status: ${note.referencesStatus}`);
      for (const warning of note.warnings) {
        console.error(`Warning: ${warning}`);
      }
    }

    const refreshedAtoms = await refreshKnowledgeAtomStatuses(workspace, {
      fileMap: {
        generatedAt: new Date().toISOString(),
        files: scan.files,
      },
      symbolMap: {
        generatedAt: new Date().toISOString(),
        symbols: scan.symbols,
      },
    });
    const atoms = refreshedAtoms.atoms;
    const pendingInbox = await listInboxNotes(workspace);
    const activeAtoms = atoms.filter((atom) => atom.status === 'active');
    const captureCheck = await buildCaptureCheck(workspace.rootPath, {
      topic,
      previousFiles: previousMaps.fileMap.files.filter(
        (file) => !shouldExclude(file.path, config),
      ),
      files: scan.files,
      atoms,
    });

    console.log(
      renderWorkflowBanner({
        files: scan.files.length,
        symbols: scan.symbols.length,
        skippedFiles: scan.skippedFiles,
        cognitionNotes: update.processed.length,
        integrations: config.integrations.map((integration) => ({
          name: integration.name,
          mode: integration.mode,
          enabled: integration.enabled,
        })),
        memory: {
          atomsProcessed: update.processed.length,
          pendingInbox: pendingInbox.length,
          activeAtoms: activeAtoms.length,
          needsReviewAtoms: atoms.filter((atom) => atom.status === 'needs-review')
            .length,
          staleAtoms: atoms.filter((atom) => atom.status === 'stale').length,
          highConfidenceMissingEvidence: activeAtoms.filter(
            (atom) =>
              atom.confidence === 'high' && atom.evidenceRefs.length === 0,
          ).length,
          captureRequired: captureCheck.required,
          changedFiles: captureCheck.changedFiles.length,
        },
      }),
    );
    console.log('');
    for (const warning of [...scan.warnings, ...update.warnings]) {
      console.warn(`Warning: ${warning}`);
    }

    if (options.final) {
      console.log('');
      renderFinalCaptureCheck(captureCheck, topic);
      if (captureCheck.required || captureCheck.unresolvedAtoms.length > 0) {
        process.exitCode = 1;
      }
      return;
    }

    if (!topic) {
      return;
    }

    const maps = await readMaps(workspace);
    const response = await queryContext(workspace, config, maps, topic);
    console.log('');
    console.log(renderContextMarkdown(response));
  });
}

async function buildCaptureCheck(
  rootPath: string,
  input: {
    topic?: string;
    previousFiles: RepositoryFile[];
    files: RepositoryFile[];
    atoms: KnowledgeAtom[];
  },
): Promise<{
  required: boolean;
  changedFiles: string[];
  coveredFiles: string[];
  invalidatedAtoms: KnowledgeAtom[];
  unresolvedAtoms: KnowledgeAtom[];
  reviewItems: MemoryReviewItem[];
}> {
  const knownFiles = new Set(input.files.map((file) => file.path));
  const previousByPath = new Map(
    input.previousFiles.map((file) => [file.path, file]),
  );
  const currentPaths = new Set(input.files.map((file) => file.path));
  const mapChangedFiles = input.files
    .filter((file) => {
      const previous = previousByPath.get(file.path);
      return !previous || previous.contentHash !== file.contentHash;
    })
    .map((file) => file.path);
  const deletedFiles = input.previousFiles
    .filter((file) => !currentPaths.has(file.path))
    .map((file) => file.path);
  const gitChangedFiles = (await getWorkingTreeChanges(rootPath)).filter(
    (file) => knownFiles.has(file) || previousByPath.has(file),
  );
  const changedFiles = [
    ...new Set([...mapChangedFiles, ...deletedFiles, ...gitChangedFiles]),
  ];
  const recentCutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recentActiveAtoms = input.atoms.filter((atom) => {
    if (atom.status !== 'active') return false;
    const createdAt = Date.parse(atom.provenance.createdAt);
    return Number.isFinite(createdAt) && createdAt >= recentCutoff;
  });
  const invalidatedAtoms = matchingInvalidatedAtoms(
    input.atoms,
    input.topic,
  ).filter((atom) => !isInvalidatedAtomCovered(atom, recentActiveAtoms));
  const unresolvedAtoms = input.atoms.filter(
    (atom) => atom.status === 'needs-review' || atom.status === 'stale',
  );
  const reviewItems = unresolvedAtoms.map((atom) => ({
    atom,
    replacement: findReplacementAtom(atom, recentActiveAtoms),
  }));
  const covered = new Set<string>();
  for (const atom of recentActiveAtoms) {
    for (const ref of atom.evidenceRefs) {
      if (ref.type === 'file' && changedFiles.includes(ref.path)) {
        covered.add(ref.path);
      }
    }
    for (const file of atom.scopeRefs.files) {
      if (changedFiles.includes(file)) {
        covered.add(file);
      }
    }
  }
  return {
    required:
      changedFiles.some((file) => !covered.has(file)) ||
      invalidatedAtoms.length > 0,
    changedFiles,
    coveredFiles: [...covered],
    invalidatedAtoms,
    unresolvedAtoms,
    reviewItems,
  };
}

interface MemoryReviewItem {
  atom: KnowledgeAtom;
  replacement?: KnowledgeAtom;
}

function isInvalidatedAtomCovered(
  invalidated: KnowledgeAtom,
  recentActiveAtoms: KnowledgeAtom[],
): boolean {
  return recentActiveAtoms.some((atom) => atomsOverlap(invalidated, atom));
}

function findReplacementAtom(
  invalidated: KnowledgeAtom,
  recentActiveAtoms: KnowledgeAtom[],
): KnowledgeAtom | undefined {
  return recentActiveAtoms.find((atom) =>
    atomsHaveReplacementSignal(invalidated, atom),
  );
}

function atomsOverlap(a: KnowledgeAtom, b: KnowledgeAtom): boolean {
  const invalidatedFiles = new Set(a.scopeRefs.files);
  const invalidatedSymbols = new Set(a.scopeRefs.symbols);
  for (const ref of a.evidenceRefs) {
    if (ref.type === 'file') invalidatedFiles.add(ref.path);
    if (ref.type === 'symbol') invalidatedSymbols.add(ref.name);
  }

  const atomFiles = new Set(b.scopeRefs.files);
  const atomSymbols = new Set(b.scopeRefs.symbols);
  for (const ref of b.evidenceRefs) {
    if (ref.type === 'file') atomFiles.add(ref.path);
    if (ref.type === 'symbol') atomSymbols.add(ref.name);
  }

  const fileOverlap = [...invalidatedFiles].some((file) =>
    atomFiles.has(file),
  );
  const symbolOverlap = [...invalidatedSymbols].some((symbol) =>
    atomSymbols.has(symbol),
  );
  if (fileOverlap || symbolOverlap) return true;
  return tokenOverlap(a.topic, b.topic);
}

function atomsHaveReplacementSignal(a: KnowledgeAtom, b: KnowledgeAtom): boolean {
  const aSymbols = new Set(a.scopeRefs.symbols);
  for (const ref of a.evidenceRefs) {
    if (ref.type === 'symbol') aSymbols.add(ref.name);
  }
  const bSymbols = new Set(b.scopeRefs.symbols);
  for (const ref of b.evidenceRefs) {
    if (ref.type === 'symbol') bSymbols.add(ref.name);
  }
  const symbolOverlap = [...aSymbols].some((symbol) => bSymbols.has(symbol));
  if (symbolOverlap) return true;
  if (!atomsShareFile(a, b)) return false;
  return meaningfulTopicOverlap(a.topic, b.topic);
}

function atomsShareFile(a: KnowledgeAtom, b: KnowledgeAtom): boolean {
  const aFiles = new Set(a.scopeRefs.files);
  for (const ref of a.evidenceRefs) {
    if (ref.type === 'file') aFiles.add(ref.path);
  }
  const bFiles = new Set(b.scopeRefs.files);
  for (const ref of b.evidenceRefs) {
    if (ref.type === 'file') bFiles.add(ref.path);
  }
  return [...aFiles].some((file) => bFiles.has(file));
}

function meaningfulTopicOverlap(a: string, b: string): boolean {
  const weakTokens = new Set([
    'add',
    'after',
    'behavior',
    'change',
    'changed',
    'new',
    'old',
    'review',
    'check',
    'current',
    'session',
    'smoke',
    'update',
    'with',
  ]);
  const aTokens = new Set(
    a
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2 && !weakTokens.has(token)),
  );
  return b
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !weakTokens.has(token))
    .some((token) => aTokens.has(token));
}

function tokenOverlap(a: string, b: string): boolean {
  const aTokens = new Set(
    a
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );
  return b
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .some((token) => aTokens.has(token));
}

function matchingInvalidatedAtoms(
  atoms: KnowledgeAtom[],
  topic?: string,
): KnowledgeAtom[] {
  const tokens = new Set(
    (topic ?? '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );
  return atoms.filter((atom) => {
    if (atom.status !== 'needs-review' && atom.status !== 'stale') return false;
    if (tokens.size === 0) return true;
    const haystack = [
      atom.topic,
      atom.claim,
      atom.summary,
      ...atom.scopeRefs.files,
      ...atom.scopeRefs.symbols,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return [...tokens].some((token) => haystack.includes(token));
  });
}

function renderFinalCaptureCheck(
  check: {
    required: boolean;
    changedFiles: string[];
    coveredFiles: string[];
    invalidatedAtoms: KnowledgeAtom[];
    unresolvedAtoms: KnowledgeAtom[];
    reviewItems: MemoryReviewItem[];
  },
  topic?: string,
): void {
  console.log('KGraph Final Check');
  if (!check.required && check.unresolvedAtoms.length > 0) {
    console.log('  status        memory-review-required');
    console.log(`  unresolved    ${check.unresolvedAtoms.length}`);
    console.log('  conclusion    stale or needs-review atoms remain');
    renderMemoryReviewItems(check.reviewItems);
    return;
  }
  if (check.changedFiles.length === 0) {
    if (check.required) {
      console.log('  status        capture-required');
      console.log('  changed files 0');
      console.log(`  invalid atoms ${check.invalidatedAtoms.length}`);
      renderMemoryReviewItems(
        check.reviewItems.filter((item) =>
          check.invalidatedAtoms.some((atom) => atom.id === item.atom.id),
        ),
      );
      console.log('  conclusion    missing for needs-review or stale knowledge');
      console.log(
        `  next          kgraph "${topic || '<topic>'}" --capture "<durable conclusion>" --capture-file <path>`,
      );
      return;
    }
    console.log('  status        clean');
    console.log('  reason        no mapped repo files changed or invalidated matching atoms');
    return;
  }
  if (!check.required) {
    console.log('  status        captured');
    console.log(`  changed files ${check.changedFiles.length}`);
    console.log(`  covered files ${check.coveredFiles.length}`);
    return;
  }
  console.log('  status        capture-required');
  console.log(`  changed files ${check.changedFiles.length}`);
  if (check.invalidatedAtoms.length > 0) {
    console.log(`  invalid atoms ${check.invalidatedAtoms.length}`);
    renderMemoryReviewItems(
      check.reviewItems.filter((item) =>
        check.invalidatedAtoms.some((atom) => atom.id === item.atom.id),
      ),
    );
  }
  console.log('  conclusion    missing for one or more changed files');
  console.log(
    `  next          kgraph "${topic || '<topic>'}" --capture "<durable conclusion>" --capture-file <path>`,
  );
}

function renderMemoryReviewItems(items: MemoryReviewItem[]): void {
  const visible = items.slice(0, 3);
  for (const item of visible) {
    console.log(`  review atom   ${item.atom.id}`);
    console.log(`  review topic  ${item.atom.status}: ${item.atom.topic}`);
    if (item.replacement) {
      console.log(
        `  supersede     kgraph knowledge supersede ${item.atom.id} ${item.replacement.id}`,
      );
    } else {
      console.log(`  inspect       kgraph knowledge get ${item.atom.id}`);
    }
  }
  if (items.length > visible.length) {
    console.log(`  review more   ${items.length - visible.length} more atom(s)`);
  }
}
