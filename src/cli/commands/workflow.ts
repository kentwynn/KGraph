import {
  refreshCognitionReferenceStatuses,
  updateCognition,
} from '../../cognition/cognition-updater.js';
import { concludeTopic } from '../../cognition/conclusion.js';
import { loadConfig } from '../../config/config.js';
import { queryContext } from '../../context/context-query.js';
import { readKnowledgeAtoms } from '../../knowledge/atom-store.js';
import { getWorkingTreeChanges } from '../../scanner/git-utils.js';
import { scanRepository } from '../../scanner/repo-scanner.js';
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

    const atoms = await readKnowledgeAtoms(workspace);
    const pendingInbox = await listInboxNotes(workspace);
    const activeAtoms = atoms.filter((atom) => atom.status === 'active');
    const captureCheck = await buildCaptureCheck(workspace.rootPath, {
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
      if (captureCheck.required) {
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
  input: { files: RepositoryFile[]; atoms: KnowledgeAtom[] },
): Promise<{ required: boolean; changedFiles: string[]; coveredFiles: string[] }> {
  const knownFiles = new Set(input.files.map((file) => file.path));
  const changedFiles = (await getWorkingTreeChanges(rootPath)).filter((file) =>
    knownFiles.has(file),
  );
  if (changedFiles.length === 0) {
    return { required: false, changedFiles, coveredFiles: [] };
  }
  const recentCutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recentActiveAtoms = input.atoms.filter((atom) => {
    if (atom.status !== 'active') return false;
    const createdAt = Date.parse(atom.provenance.createdAt);
    return Number.isFinite(createdAt) && createdAt >= recentCutoff;
  });
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
    required: changedFiles.some((file) => !covered.has(file)),
    changedFiles,
    coveredFiles: [...covered],
  };
}

function renderFinalCaptureCheck(
  check: { required: boolean; changedFiles: string[]; coveredFiles: string[] },
  topic?: string,
): void {
  console.log('KGraph Final Check');
  if (check.changedFiles.length === 0) {
    console.log('  status        clean');
    console.log('  reason        no mapped repo files changed');
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
  console.log('  conclusion    missing for one or more changed files');
  console.log(
    `  next          kgraph "${topic || '<topic>'}" --capture "<durable conclusion>" --capture-file <path>`,
  );
}
