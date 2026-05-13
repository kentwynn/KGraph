import type { Command } from 'commander';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import {
  analyzeCognitionQuality,
  type CognitionQualityReport,
} from '../../cognition/cognition-quality.js';
import { loadConfig } from '../../config/config.js';
import { listIntegrations } from '../../integrations/integration-store.js';
import { validateKnowledgeStore } from '../../knowledge/atom-store.js';
import { getCurrentCommit, isGitRepo } from '../../scanner/git-utils.js';
import {
  assertWorkspace,
  pathExists,
  resolveWorkspace,
} from '../../storage/kgraph-paths.js';
import { mapPaths, mapsExist, readMaps } from '../../storage/map-store.js';
import { runCommand } from '../errors.js';

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Check KGraph workspace health and next actions')
    .option('--quality', 'Report stale or noisy cognition references')
    .action((options: { quality?: boolean }) =>
      runCommand(async () => {
        const rootPath = process.cwd();
        const workspace = resolveWorkspace(rootPath);
        const checks: Array<{ label: string; ok: boolean; detail: string }> =
          [];

        const initialized = await pathExists(workspace.kgraphPath);
        checks.push({
          label: 'workspace',
          ok: initialized,
          detail: initialized ? '.kgraph exists' : 'run `kgraph init` first',
        });

        if (!initialized) {
          printChecks(checks);
          process.exitCode = 1;
          return;
        }

        await assertWorkspace(rootPath);
        const config = await loadConfig(workspace);
        checks.push({
          label: 'config',
          ok: true,
          detail: `${config.include.length} include pattern(s), ${config.exclude.length} exclude pattern(s)`,
        });

        const mapStatus = await mapsExist(workspace);
        checks.push({
          label: 'maps',
          ok: mapStatus,
          detail: mapStatus
            ? 'structural maps are present'
            : 'run `kgraph scan` or just `kgraph`',
        });

        const maps = mapStatus ? await readMaps(workspace) : undefined;
        if (maps) {
          checks.push({
            label: 'scan result',
            ok: true,
            detail: `${maps.fileMap.files.length} files, ${maps.symbolMap.symbols.length} symbols, ${maps.dependencyMap.dependencies.length} dependencies`,
          });

          // Detect whether the repo has advanced past the commit that was scanned
          if (maps.fileMap.scannedAtCommit && (await isGitRepo(rootPath))) {
            const headCommit = await getCurrentCommit(rootPath);
            const stale =
              headCommit !== null &&
              headCommit !== maps.fileMap.scannedAtCommit;
            checks.push({
              label: 'scan freshness',
              ok: !stale,
              detail: stale
                ? `scanned at ${maps.fileMap.scannedAtCommit.slice(0, 7)}, HEAD is ${headCommit!.slice(0, 7)} — run \`kgraph scan\``
                : `maps current at ${maps.fileMap.scannedAtCommit.slice(0, 7)}`,
            });
          }
        } else {
          const paths = mapPaths(workspace);
          const missing = [];
          for (const [name, filePath] of Object.entries(paths)) {
            if (!(await pathExists(filePath))) missing.push(name);
          }
          checks.push({
            label: 'missing maps',
            ok: false,
            detail: missing.join(', '),
          });
        }

        const knowledgeIssues = await validateKnowledgeStore(
          workspace,
          maps
            ? { fileMap: maps.fileMap, symbolMap: maps.symbolMap }
            : undefined,
        );
        checks.push({
          label: 'knowledge',
          ok: knowledgeIssues.length === 0,
          detail:
            knowledgeIssues.length === 0
              ? 'knowledge atoms, schema, and refs are valid'
              : knowledgeIssues
                  .slice(0, 3)
                  .map((issue) => issue.message)
                  .join('; ') +
                (knowledgeIssues.length > 3
                  ? `; and ${knowledgeIssues.length - 3} more`
                  : ''),
        });

        const inboxCount = await countMarkdownFiles(workspace.inboxPath);
        checks.push({
          label: 'inbox',
          ok: true,
          detail:
            inboxCount === 0
              ? 'no pending cognition notes'
              : `${inboxCount} note(s) waiting for \`kgraph update\``,
        });

        const integrations = await listIntegrations(workspace);
        checks.push({
          label: 'integrations',
          ok: integrations.every((integration) => integration.targetExists),
          detail:
            integrations.length === 0
              ? 'none configured'
              : integrations
                  .map((integration) =>
                    integration.targetExists
                      ? `${integration.name}: ${integration.targetPath}`
                      : `${integration.name}: missing ${integration.targetPath}`,
                  )
                  .join('; '),
        });

        let qualityReport: CognitionQualityReport | undefined;
        const knowledgeReadable = !knowledgeIssues.some(
          (issue) => issue.code === 'invalid-jsonl' || issue.code === 'missing-schema',
        );
        if (maps && knowledgeReadable) {
          qualityReport = await analyzeCognitionQuality(workspace, maps);
          const qualityFindings = summarizeQualityFindings(qualityReport);
          const coverageNotes = summarizeCoverageNotes(qualityReport);
          checks.push({
            label: 'quality gate',
            ok: qualityFindings.length === 0,
            detail:
              qualityFindings.length === 0
                ? [
                    'no stale/noisy cognition, generated scan noise, or duplicate titles',
                    ...coverageNotes,
                  ].join('; ')
                : qualityFindings.join('; '),
          });
        } else if (maps) {
          checks.push({
            label: 'quality gate',
            ok: false,
            detail: 'knowledge storage is invalid; fix knowledge check first',
          });
        }

        printChecks(checks);
        if (options.quality && maps && knowledgeReadable) {
          console.log('');
          console.log('KGraph Cognition Quality');
          console.log('');
          printQualityReport(
            qualityReport ?? (await analyzeCognitionQuality(workspace, maps)),
          );
        }
        if (checks.some((check) => !check.ok)) {
          process.exitCode = 1;
        }
      }),
    );
}

async function countMarkdownFiles(dirPath: string): Promise<number> {
  if (!(await pathExists(dirPath))) {
    return 0;
  }
  const entries = await readdir(dirPath, { withFileTypes: true });
  return entries.filter(
    (entry) => entry.isFile() && path.extname(entry.name) === '.md',
  ).length;
}

function printChecks(
  checks: Array<{ label: string; ok: boolean; detail: string }>,
): void {
  console.log('KGraph Doctor');
  console.log('');
  for (const check of checks) {
    console.log(`${check.ok ? 'OK' : 'FAIL'}  ${check.label}: ${check.detail}`);
  }
}

export function printQualityReport(report: CognitionQualityReport): void {
  console.log(`Atoms: ${report.atomCount}`);
  console.log(`Needs-review atoms: ${report.needsReviewAtomCount}`);
  console.log(`Stale atoms: ${report.staleAtomCount}`);
  console.log(`Archived atoms: ${report.archivedAtomCount}`);
  console.log(`Duplicate atom topics: ${report.duplicateAtomTopicCount}`);
  console.log(`Compatibility notes: ${report.noteCount}`);
  console.log(`Mixed/stale/unresolved compatibility notes: ${report.mixedOrStaleCount}`);
  console.log(`Orphaned atoms (all refs dead): ${report.orphanedNoteCount}`);
  console.log(`Noisy file refs: ${report.noisyFileRefCount}`);
  console.log(`Noisy symbol refs: ${report.noisySymbolRefCount}`);
  console.log(`Unresolved local imports: ${report.unresolvedLocalImportCount}`);
  console.log(`Unresolved call edges: ${report.unresolvedCallCount}`);
  console.log(`Duplicate compatibility note titles: ${report.duplicateTitleCount}`);
  console.log(`Generated files scanned: ${report.generatedFileScanCount}`);
  console.log(`Expensive files: ${report.expensiveFileCount}`);
  console.log(
    `High-confidence atoms without evidence: ${report.highConfidenceMissingEvidenceCount}`,
  );
  console.log(`Session repeated reads: ${report.sessionRepeatedReadCount}`);
  console.log(
    `Session estimated read tokens: ${report.sessionEstimatedReadTokens}`,
  );
  console.log(
    `Session repeated-read tokens: ${report.sessionEstimatedRepeatedReadTokens}`,
  );
  if (report.changes.length === 0) {
    return;
  }
  console.log('');
  for (const change of report.changes) {
    console.log(`- ${change.title}`);
    for (const ref of change.removedFileRefs) {
      console.log(`  remove file ref: ${ref}`);
    }
    for (const ref of change.removedSymbolRefs) {
      console.log(`  remove symbol ref: ${ref}`);
    }
    console.log(`  next status: ${change.nextStatus}`);
  }
}

function summarizeQualityFindings(report: CognitionQualityReport): string[] {
  const findings: string[] = [];
  if (report.orphanedNoteCount > 0) {
    findings.push(
      `${report.orphanedNoteCount} orphaned atom(s) (all refs dead); run \`kgraph repair\` to archive`,
    );
  }
  if (report.staleAtomCount > 0 || report.needsReviewAtomCount > 0) {
    findings.push(
      `${report.staleAtomCount} stale atom(s), ${report.needsReviewAtomCount} needs-review atom(s)`,
    );
  }
  if (report.noisyFileRefCount > 0 || report.noisySymbolRefCount > 0) {
    findings.push(
      `${report.noisyFileRefCount + report.noisySymbolRefCount} noisy atom ref(s); run \`kgraph repair --dry-run\``,
    );
  }
  if (report.duplicateAtomTopicCount > 0) {
    findings.push(`${report.duplicateAtomTopicCount} duplicate atom topic(s)`);
  }
  if (report.generatedFileScanCount > 0) {
    findings.push(
      `${report.generatedFileScanCount} generated/integration file(s) scanned; update excludes`,
    );
  }
  if (report.highConfidenceMissingEvidenceCount > 0) {
    findings.push(
      `${report.highConfidenceMissingEvidenceCount} high-confidence atom(s) without evidence; add file/symbol refs or supersede`,
    );
  }
  return findings;
}

function summarizeCoverageNotes(report: CognitionQualityReport): string[] {
  const notes: string[] = [];
  if (report.unresolvedLocalImportCount > 0) {
    notes.push(
      `${report.unresolvedLocalImportCount} unresolved local import(s) visible in --quality`,
    );
  }
  if (report.unresolvedCallCount > 0) {
    notes.push(
      `${report.unresolvedCallCount} unresolved call edge(s) visible in --quality`,
    );
  }
  return notes;
}
