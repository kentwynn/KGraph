import { updateCognition } from '../../cognition/cognition-updater.js';
import { refreshCognitionReferenceStatuses } from '../../cognition/cognition-updater.js';
import { loadConfig } from '../../config/config.js';
import { queryContext } from '../../context/context-query.js';
import { scanRepository } from '../../scanner/repo-scanner.js';
import { assertWorkspace } from '../../storage/kgraph-paths.js';
import { readMaps, writeMaps } from '../../storage/map-store.js';
import { runCommand } from '../errors.js';
import { renderContextMarkdown } from './context.js';

export async function runDefaultWorkflow(query?: string): Promise<void> {
  await runCommand(async () => {
    const topic = query?.trim();
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

    console.log(
      `KGraph refreshed ${scan.files.length} files, ${scan.symbols.length} symbols, and ${update.processed.length} cognition notes.`,
    );
    for (const warning of [...scan.warnings, ...update.warnings]) {
      console.warn(`Warning: ${warning}`);
    }

    if (!topic) {
      console.log('Add a topic to return compact context, for example: kgraph "auth token refresh"');
      return;
    }

    const maps = await readMaps(workspace);
    const response = await queryContext(workspace, config, maps, topic);
    console.log('');
    console.log(renderContextMarkdown(response));
  });
}
