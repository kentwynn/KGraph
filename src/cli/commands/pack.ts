import type { Command } from 'commander';
import { buildContextPack } from '../../context/context-pack.js';
import { queryContext } from '../../context/context-query.js';
import { loadConfig } from '../../config/config.js';
import {
  assertSessionAgent,
  recordSessionEvent,
} from '../../session/session-store.js';
import { assertWorkspace } from '../../storage/kgraph-paths.js';
import { mapsExist, readMaps } from '../../storage/map-store.js';
import type { ContextPack, ContextPackItem } from '../../types/knowledge.js';
import { KGraphError, runCommand } from '../errors.js';

interface PackOptions {
  budget?: string;
  json?: boolean;
  agent?: string;
}

export function registerPackCommand(program: Command): void {
  program
    .command('pack <task>')
    .description('Build a budget-aware KGraph context pack for a task')
    .option('--budget <tokens>', 'Maximum estimated tokens to include', '8000')
    .option('--json', 'Print JSON output')
    .option('--agent <name>', 'Record an automatic KGraph session context event for this integration agent')
    .action((task: string, options: PackOptions, command: Command) =>
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
        const agent =
          options.agent ??
          (command.getOptionValue('agent') as string | undefined) ??
          findCommandOption(command, 'agent');
        if (agent) {
          await recordSessionEvent(workspace, {
            agent: assertSessionAgent(agent),
            type: 'context',
            captureSource: 'automatic',
          });
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
        console.log(renderPackText(pack));
      }),
    );
}

function findCommandOption(
  command: Command | undefined,
  name: string,
): string | undefined {
  let current = command?.parent;
  while (current) {
    const value =
      (current.getOptionValue(name) as string | undefined) ??
      current.opts<Record<string, string | undefined>>()[name];
    if (value) {
      return value;
    }
    current = current.parent;
  }
  return undefined;
}

export function renderPackText(pack: ContextPack): string {
  const lines = [
    `KGraph Pack · ${pack.task}`,
    `local-first · budget-aware · machine contract: --json`,
    ``,
    `● Budget`,
    `  used        ${pack.usedTokens} / ${pack.budget}`,
    `  included    ${pack.items.length}`,
    `  omitted     ${pack.omitted.length}`,
    ``,
  ];

  appendGroup(lines, 'Atoms', pack.items.filter((item) => item.kind === 'atom'));
  appendGroup(lines, 'Git Changes', pack.items.filter((item) => item.kind === 'git-change'));
  appendGroup(lines, 'Source Ranges', pack.items.filter((item) => item.kind === 'file-range'));
  appendGroup(lines, 'Symbols', pack.items.filter((item) => item.kind === 'symbol'));
  appendGroup(lines, 'Files', pack.items.filter((item) => item.kind === 'file'));
  appendGroup(lines, 'Graph', pack.items.filter((item) => item.kind === 'relationship'));

  lines.push(`● Omitted`);
  const omitted = pack.omitted.slice(0, 8);
  if (omitted.length === 0) {
    lines.push('- None');
  } else {
    for (const item of omitted) {
      lines.push(`  ◌ ${item.kind} ${item.title} (~${item.tokenEstimate} tokens)`);
    }
    if (pack.omitted.length > omitted.length) {
      lines.push(`  ◌ ${pack.omitted.length - omitted.length} more omitted items`);
    }
  }

  lines.push('', '● Next', '  agents should consume this command with --json for the full ContextPack contract');
  return lines.join('\n');
}

function appendGroup(lines: string[], title: string, items: ContextPackItem[]): void {
  lines.push(`● ${title}`);
  if (items.length === 0) {
    lines.push('- None', '');
    return;
  }
  for (const item of items.slice(0, 6)) {
    lines.push(`  ● ${item.title} (~${item.tokenEstimate} tokens)`);
    lines.push(`    because ${formatReasons(item.reasons)}`);
    if (item.kind === 'file-range') {
      const data = item.data as { path?: string; startLine?: number; endLine?: number };
      if (data.path && data.startLine != null && data.endLine != null) {
        lines.push(`    range ${data.path}:${data.startLine}-${data.endLine}`);
      }
    }
  }
  if (items.length > 6) lines.push(`  ◌ ${items.length - 6} more ${title.toLowerCase()} omitted from display`);
  lines.push('');
}

function formatReasons(reasons: string[]): string {
  if (reasons.length === 0) return 'included by pack ranking';
  const shown = reasons.slice(0, 3);
  const remaining = reasons.length - shown.length;
  return remaining > 0 ? `${shown.join('; ')}; and ${remaining} more` : shown.join('; ');
}
