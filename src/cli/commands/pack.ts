import type { Command } from 'commander';
import { buildContextPack } from '../../context/context-pack.js';
import { queryContext } from '../../context/context-query.js';
import { loadConfig } from '../../config/config.js';
import { assertWorkspace } from '../../storage/kgraph-paths.js';
import { mapsExist, readMaps } from '../../storage/map-store.js';
import { KGraphError, runCommand } from '../errors.js';

interface PackOptions {
  budget?: string;
  json?: boolean;
}

export function registerPackCommand(program: Command): void {
  program
    .command('pack <task>')
    .description('Build a budget-aware KGraph context pack for a task')
    .option('--budget <tokens>', 'Maximum estimated tokens to include', '8000')
    .option('--json', 'Print JSON output')
    .action((task: string, options: PackOptions) =>
      runCommand(async () => {
        if (!task.trim()) throw new KGraphError('Task cannot be empty.');
        const budget = Number.parseInt(options.budget ?? '8000', 10);
        if (!Number.isFinite(budget) || budget < 1) {
          throw new KGraphError('--budget must be a positive integer.');
        }
        const workspace = await assertWorkspace(process.cwd());
        if (!(await mapsExist(workspace))) {
          throw new KGraphError('KGraph maps are missing. Run `kgraph scan` first.');
        }
        const [config, maps] = await Promise.all([
          loadConfig(workspace),
          readMaps(workspace),
        ]);
        const response = await queryContext(workspace, config, maps, task);
        const pack = buildContextPack(response, budget, workspace.rootPath);
        if (options.json) {
          console.log(JSON.stringify(pack, null, 2));
          return;
        }
        console.log(`# KGraph Context Pack`);
        console.log('');
        console.log(`Task: ${pack.task}`);
        console.log(`Budget: ${pack.budget}`);
        console.log(`Used: ${pack.usedTokens}`);
        console.log('');
        for (const item of pack.items) {
          console.log(`- [${item.kind}] ${item.title} (~${item.tokenEstimate} tokens)`);
          console.log(`  because ${item.reasons.slice(0, 3).join('; ')}`);
        }
        if (pack.omitted.length > 0) {
          console.log('');
          console.log(`Omitted: ${pack.omitted.length} item(s) over budget`);
        }
      }),
    );
}
