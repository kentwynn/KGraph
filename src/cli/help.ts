import { Chalk } from 'chalk';

type Theme = InstanceType<typeof Chalk>;

export function renderRootHelp(useColor = supportsColor()): string {
  const theme = new Chalk({ level: useColor ? 3 : 0 });
  const command = (name: string, description: string) =>
    `  ${theme.green(name.padEnd(42))} ${description}`;
  const accent = atomAccent(theme);

  return [
    '',
    renderAtomLogo(theme),
    '',
    renderSignalPanel(theme, [
      ['purpose', 'durable engineering memory for AI coding tools'],
      ['storage', '.kgraph/ atoms, maps, indexes, and session history'],
      ['stance', 'local-first · deterministic-first · inspectable'],
      ['agents', 'Codex · Copilot · Cursor · Claude Code · Gemini · Windsurf · Cline'],
    ]),
    '',
    sectionTitle(theme, `${accent} Usage`),
    '  kgraph [topic]',
    '  kgraph <command> [options]',
    '',
    sectionTitle(theme, `${accent} Start`),
    command('init', 'Required once: create .kgraph/ workspace'),
    command(
      'init --integrations codex,gemini',
      'Optional: initialize and connect named AI tools',
    ),
    '',
    sectionTitle(theme, `${accent} Daily workflow`),
    command('kgraph', 'Refresh scan maps and process pending capture notes'),
    command(
      'kgraph "auth token refresh"',
      'Refresh everything and return compact context for a topic',
    ),
    command(
      'kgraph "auth token refresh" --final',
      'End-of-work check: enforce capture when changed files need memory',
    ),
    command(
      'kgraph "auth token refresh" --capture "..."',
      'Store durable knowledge through the smart root workflow',
    ),
    '',
    sectionTitle(theme, `${accent} Workflows`),
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
    command(
      'pack "auth task" --agent codex',
      'Record lightweight agent session context while building a pack',
    ),
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
    sectionTitle(theme, `${accent} Integrations`),
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
    sectionTitle(theme, `${accent} Options`),
    command('-V, --version', 'Show version'),
    command('-h, --help', 'Show this help'),
    command('--final', 'Run final capture enforcement in the root workflow'),
    command('--capture <text>', 'Store a durable conclusion in the root workflow'),
    command('--capture-file <path>', 'Attach file evidence to root capture'),
    command('--capture-symbol <name>', 'Attach symbol evidence to root capture'),
    command('--agent <name>', 'Record lightweight agent session context'),
    '',
    sectionTitle(theme, `${accent} Examples`),
    '  kgraph init',
    '  kgraph integrate add codex copilot cursor claude-code gemini windsurf cline',
    '  kgraph "blog admin token usage"',
    '  kgraph "blog admin token usage" --final',
    '  kgraph "blog admin token usage" --capture "Author filter now uses display names" --capture-file www/app/blog/page.tsx',
    '  kgraph pack "about page update" --budget 4000',
    '  kgraph doctor',
    '',
    theme.dim('Docs: https://github.com/kentwynn/KGraph#readme'),
    theme.dim('Powered by Kent Wynn: https://kentwynn.com'),
    '',
  ].join('\n');
}

interface WorkflowBannerStats {
  files: number;
  symbols: number;
  cognitionNotes: number;
  skippedFiles?: number;
  integrations?: WorkflowBannerIntegration[];
  memory?: WorkflowBannerMemory;
}

interface WorkflowBannerIntegration {
  name: string;
  mode: string;
  enabled: boolean;
}

interface WorkflowBannerMemory {
  atomsProcessed: number;
  pendingInbox: number;
  activeAtoms: number;
  needsReviewAtoms: number;
  staleAtoms: number;
  highConfidenceMissingEvidence: number;
  changedFiles?: number;
  captureRequired?: boolean;
}

export function renderWorkflowBanner(
  stats: WorkflowBannerStats,
  useColor = supportsColor(),
): string {
  const theme = new Chalk({ level: useColor ? 3 : 0 });
  const accent = atomAccent(theme);
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
    renderAtomLogo(theme),
    '',
    `  ${theme.bold('KGraph')} ${theme.dim('· repo intelligence refreshed')}`,
    '',
    sectionTitle(theme, `${accent} Refresh Complete`),
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
    ...(stats.memory
      ? [
          '',
          sectionTitle(theme, `${accent} Memory`),
          command('atoms processed', String(stats.memory.atomsProcessed)),
          command('pending inbox', String(stats.memory.pendingInbox)),
          command('active atoms', String(stats.memory.activeAtoms)),
          command('needs review', String(stats.memory.needsReviewAtoms)),
          command('stale', String(stats.memory.staleAtoms)),
          command(
            'high-confidence missing evidence',
            String(stats.memory.highConfidenceMissingEvidence),
          ),
          command(
            'capture status',
            stats.memory.captureRequired
              ? `required (${stats.memory.changedFiles ?? 0} changed file(s))`
              : `ok (${stats.memory.changedFiles ?? 0} changed file(s))`,
          ),
        ]
      : []),
    '',
    sectionTitle(theme, `${accent} Next`),
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

function renderAtomLogo(theme: Theme): string {
  const title = `${theme.hex('#38bdf8').bold('KGraph')} ${theme.dim('·')} ${theme.hex('#c084fc').bold('Atom Core')}`;
  const atom = theme.hex('#22d3ee').bold('⚛');
  const memory = theme.hex('#a78bfa')('persistent repo intelligence for AI coding tools');
  return [
    `  ${atom}  ${theme.dim('atoms · evidence · context packs')}`,
    `     ${title}`,
    `     ${memory}`,
  ].join('\n');
}

function renderSignalPanel(theme: Theme, rows: Array<[string, string]>): string {
  const labelWidth = Math.max(...rows.map(([label]) => label.length));
  return rows
    .map(
      ([label, value]) =>
        `  ${theme.hex('#22d3ee')('●')} ${theme.bold(label.padEnd(labelWidth))}  ${theme.dim(value)}`,
    )
    .join('\n');
}

function sectionTitle(theme: Theme, title: string): string {
  return theme.bold(title);
}

function atomAccent(theme: Theme): string {
  return theme.hex('#22d3ee')('●');
}

function supportsColor(): boolean {
  return Boolean(process.stdout.isTTY) && process.env.NO_COLOR === undefined;
}
