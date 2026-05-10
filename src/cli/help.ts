import { Chalk } from 'chalk';
import figlet from 'figlet';

export function renderRootHelp(useColor = supportsColor()): string {
  const theme = new Chalk({ level: useColor ? 3 : 0 });
  const command = (name: string, description: string) =>
    `  ${theme.green(name.padEnd(30))} ${description}`;
  const logo = renderLogo();

  return [
    '',
    theme.hex('#7dd3fc').bold(logo),
    '',
    `  ${theme.bold('KGraph')} ${theme.dim('Persistent repo intelligence for AI coding tools')}`,
    '',
    `  ${theme.hex('#c084fc')('Build a local knowledge layer that helps Codex, Copilot, Cursor,')}`,
    `  ${theme.hex('#c084fc')('and Claude Code reuse repo structure, decisions, and debugging history.')}`,
    '',
    theme.bold('Usage'),
    '  kgraph [topic]',
    '  kgraph <command> [options]',
    '',
    theme.bold('Start'),
    command('init', 'Required once: create .kgraph/ workspace'),
    command(
      'init --integrations codex,cursor',
      'Initialize and connect AI tools',
    ),
    '',
    theme.bold('Daily workflow'),
    command('kgraph', 'Refresh scan maps and process pending cognition notes'),
    command(
      'kgraph "auth token refresh"',
      'Refresh everything and return compact context for a topic',
    ),
    '',
    theme.bold('Workflows'),
    command('scan', 'Optional: refresh only file, symbol, import, and relationship maps'),
    command(
      'context "auth token refresh"',
      'Optional: return context without scanning or updating',
    ),
    command('update', 'Optional: process only .kgraph/inbox Markdown cognition notes'),
    command('doctor', 'Check workspace health and next actions'),
    command(
      'visualize',
      'Interactive dependency graph at http://localhost:4242',
    ),
    command('history', 'Timeline of processed cognition sessions'),
    '',
    theme.bold('Integrations'),
    command('integrate list', 'Show configured AI tool integrations'),
    command(
      'integrate add codex copilot',
      'Write KGraph instructions for AI tools',
    ),
    command(
      'integrate remove cursor',
      'Remove KGraph-managed instruction blocks',
    ),
    '',
    theme.bold('Options'),
    command('-V, --version', 'Show version'),
    command('-h, --help', 'Show this help'),
    '',
    `${theme.yellow('Examples')}`,
    '  kgraph init --integrations codex,copilot,cursor',
    '  kgraph "blog admin token usage"',
    '  kgraph doctor',
    '',
    theme.dim('Docs: https://github.com/kentwynn/KGraph#readme'),
    '',
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
