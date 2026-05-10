import type { Command } from 'commander';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
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
    .action(() =>
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

        if (mapStatus) {
          const maps = await readMaps(workspace);
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
