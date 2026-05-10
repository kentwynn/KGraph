import type { Command } from 'commander';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import {
  analyzeCognitionQuality,
  type CognitionQualityReport,
} from '../../cognition/cognition-quality.js';
import { loadConfig } from '../../config/config.js';
import { listIntegrations } from '../../integrations/integration-store.js';
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
        const checks: Array<{ label: string; ok: boolean; detail: string }> = [];

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
          detail: mapStatus ? 'structural maps are present' : 'run `kgraph scan` or just `kgraph`',
        });

        const maps = mapStatus ? await readMaps(workspace) : undefined;
        if (maps) {
          checks.push({
            label: 'scan result',
            ok: true,
            detail: `${maps.fileMap.files.length} files, ${maps.symbolMap.symbols.length} symbols, ${maps.dependencyMap.dependencies.length} dependencies`,
          });
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

        printChecks(checks);
        if (options.quality && maps) {
          console.log('');
          console.log('KGraph Cognition Quality');
          console.log('');
          printQualityReport(await analyzeCognitionQuality(workspace, maps));
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
  console.log(`Notes: ${report.noteCount}`);
  console.log(`Mixed/stale/unresolved notes: ${report.mixedOrStaleCount}`);
  console.log(`Noisy file refs: ${report.noisyFileRefCount}`);
  console.log(`Noisy symbol refs: ${report.noisySymbolRefCount}`);
  console.log(`Unresolved local imports: ${report.unresolvedLocalImportCount}`);
  console.log(`Unresolved call edges: ${report.unresolvedCallCount}`);
  console.log(`Duplicate cognition titles: ${report.duplicateTitleCount}`);
  console.log(`Generated files scanned: ${report.generatedFileScanCount}`);
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
