import { Chalk } from 'chalk';
import figlet from 'figlet';

export function renderRootHelp(useColor = supportsColor()): string {
  const theme = new Chalk({ level: useColor ? 3 : 0 });
  const command = (name: string, description: string) =>
    `  ${theme.green(name.padEnd(42))} ${description}`;
  const logo = renderLogo();

  return [
    '',
    theme.hex('#7dd3fc').bold(logo),
    '',
    `  ${theme.bold('KGraph')} ${theme.dim('Persistent repo intelligence for AI coding tools')}`,
    '',
    `  ${theme.hex('#c084fc')('Build a local knowledge layer that helps Codex, Copilot, Cursor,')}`,
    `  ${theme.hex('#c084fc')('Claude Code, Gemini, Windsurf, and Cline reuse repo intelligence.')}`,
    '',
    theme.bold('Usage'),
    '  kgraph [topic]',
    '  kgraph <command> [options]',
    '',
    theme.bold('Start'),
    command('init', 'Required once: create .kgraph/ workspace'),
    command(
      'init --integrations codex,gemini',
      'Initialize and connect AI tools',
    ),
    '',
    theme.bold('Daily workflow'),
    command('kgraph', 'Refresh scan maps and process pending capture notes'),
    command(
      'kgraph "auth token refresh"',
      'Refresh everything and return compact context for a topic',
    ),
    '',
    theme.bold('Workflows'),
    command(
      'scan',
      'Optional: refresh only file, symbol, import, and relationship maps',
    ),
    command('session', 'Show agent read/write activity and token estimates'),
    command(
      'session read src/auth.ts --agent codex',
      'Record an agent file read',
    ),
    command(
      'session end --agent codex --conclude',
      'End tracking and store a durable session summary',
    ),
    command(
      'conclude "auth refresh gotcha"',
      'Store typed engineering knowledge',
    ),
    command('compact', 'Merge duplicate atoms and archive stale noise'),
    command('knowledge list', 'Inspect canonical knowledge atoms'),
    command('pack "auth task" --budget 8000', 'Build a budget-aware context pack'),
    command('stale', 'Show atoms invalidated by changed or missing refs'),
    command('blame <atom-id>', 'Show atom provenance and evidence'),
    command(
      'context "auth token refresh"',
      'Optional: return context without scanning or updating',
    ),
    command(
      'impact "Button"',
      'Show imports, callers, calls, knowledge, and risk',
    ),
    command(
      'update',
      'Optional: process only .kgraph/inbox capture notes',
    ),
    command('doctor', 'Check workspace health and next actions'),
    command('doctor --quality', 'Report stale/noisy atom references'),
    command('repair --dry-run', 'Preview atom reference cleanup'),
    command('repair', 'Clean noisy stale atom references'),
    command('uninstall', 'Preview repo-local KGraph removal'),
    command('uninstall --yes', 'Remove .kgraph/ and managed integrations'),
    command(
      'visualize',
      'Interactive dependency graph at http://localhost:4242',
    ),
    command('history "blog button"', 'Search processed cognition sessions'),
    '',
    theme.bold('Integrations'),
    command('integrate list', 'Show configured AI tool integrations'),
    command(
      'integrate add gemini windsurf cline',
      'Write KGraph instructions using always mode by default',
    ),
    command(
      'integrate add copilot --mode smart',
      'Run KGraph for repo-specific Copilot work only',
    ),
    command(
      'integrate set copilot --mode manual',
      'Only run KGraph when explicitly requested',
    ),
    command(
      'integrate remove cursor',
      'Remove KGraph-managed instruction blocks',
    ),
    command(
      '--mode smart|always|manual|off',
      'Control automatic KGraph involvement per integration',
    ),
    '',
    theme.bold('Options'),
    command('-V, --version', 'Show version'),
    command('-h, --help', 'Show this help'),
    '',
    `${theme.yellow('Examples')}`,
    '  kgraph init --integrations codex,copilot,cursor,claude-code,gemini,windsurf,cline',
    '  kgraph "blog admin token usage"',
    '  kgraph doctor',
    '',
    theme.dim('Docs: https://github.com/kentwynn/KGraph#readme'),
    '',
  ].join('\n');
}

interface WorkflowBannerStats {
  files: number;
  symbols: number;
  cognitionNotes: number;
  skippedFiles?: number;
  integrations?: WorkflowBannerIntegration[];
}

interface WorkflowBannerIntegration {
  name: string;
  mode: string;
  enabled: boolean;
}

export function renderWorkflowBanner(
  stats: WorkflowBannerStats,
  useColor = supportsColor(),
): string {
  const theme = new Chalk({ level: useColor ? 3 : 0 });
  const command = (name: string, description: string) =>
    `  ${theme.green(name.padEnd(42))} ${description}`;
  const integrationLine =
    stats.integrations && stats.integrations.length > 0
      ? stats.integrations
          .map((integration) =>
            integration.enabled
              ? `${integration.name}:${integration.mode}`
              : `${integration.name}:off`,
          )
          .join(', ')
      : 'none configured';

  return [
    '',
    theme.hex('#7dd3fc').bold(renderLogo()),
    '',
    `  ${theme.bold('KGraph')} ${theme.dim('repo intelligence refreshed')}`,
    '',
    theme.bold('Refresh Complete'),
    command(
      'files',
      String(stats.files) +
        (stats.skippedFiles
          ? ` (${stats.skippedFiles} unchanged, skipped)`
          : ''),
    ),
    command('symbols', String(stats.symbols)),
    command('capture notes processed', String(stats.cognitionNotes)),
    command('integration modes', integrationLine),
    '',
    theme.bold('Next'),
    command(
      'kgraph "auth token refresh"',
      'Return compact context for a topic',
    ),
    command('kgraph doctor', 'Check workspace health'),
    command('kgraph doctor --quality', 'Check atom quality'),
    command('kgraph knowledge list', 'Inspect knowledge atoms'),
    command('kgraph pack "auth task"', 'Build budget-aware context'),
    command('kgraph session', 'Check session token waste'),
    command('kgraph --help', 'Show all commands'),
  ].join('\n');
}

function renderLogo(): string {
  try {
    return figlet.textSync('KGraph', {
      font: 'ANSI Shadow',
      horizontalLayout: 'default',
      verticalLayout: 'default',
    });
  } catch {
    return 'KGraph';
  }
}

function supportsColor(): boolean {
  return Boolean(process.stdout.isTTY) && process.env.NO_COLOR === undefined;
}
