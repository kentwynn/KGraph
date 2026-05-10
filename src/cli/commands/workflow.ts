import { updateCognition } from '../../cognition/cognition-updater.js';
import { refreshCognitionReferenceStatuses } from '../../cognition/cognition-updater.js';
import { loadConfig } from '../../config/config.js';
import { queryContext } from '../../context/context-query.js';
import { scanRepository } from '../../scanner/repo-scanner.js';
import {
  assertWorkspace,
  pathExists,
  resolveWorkspace,
} from '../../storage/kgraph-paths.js';
import { readMaps, writeMaps } from '../../storage/map-store.js';
import { runCommand } from '../errors.js';
import { renderRootHelp, renderWorkflowBanner } from '../help.js';
import { renderContextMarkdown } from './context.js';

export async function runDefaultWorkflow(query?: string): Promise<void> {
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

    console.log(renderWorkflowBanner({
      files: scan.files.length,
      symbols: scan.symbols.length,
      cognitionNotes: update.processed.length,
      integrations: config.integrations.map((integration) => ({
        name: integration.name,
        mode: integration.mode,
        enabled: integration.enabled,
      })),
    }));
    console.log('');
    for (const warning of [...scan.warnings, ...update.warnings]) {
      console.warn(`Warning: ${warning}`);
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
