const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const MAGENTA = "\x1b[35m";
const YELLOW = "\x1b[33m";

export function renderRootHelp(useColor = supportsColor()): string {
  const c = (code: string, value: string) => (useColor ? `${code}${value}${RESET}` : value);
  const command = (name: string, description: string) => `  ${c(GREEN, name.padEnd(30))} ${description}`;
  const logo = [
    "  _  __  ____                 _     ",
    " | |/ / / ___| _ __ __ _ ___ | |__  ",
    " | ' / | |  _ | '__/ _` / __|| '_ \\ ",
    " | . \\ | |_| || | | (_| \\__ \\| | | |",
    " |_|\\_\\ \\____||_|  \\__,_|___/|_| |_|"
  ];

  return [
    "",
    c(CYAN + BOLD, logo.join("\n")),
    "",
    `  ${c(BOLD, "KGraph")} ${c(DIM, "Persistent repo intelligence for AI coding tools")}`,
    "",
    `  ${c(MAGENTA, "Build a local knowledge layer that helps Codex, Copilot, Cursor,")}`,
    `  ${c(MAGENTA, "and Claude Code reuse repo structure, decisions, and debugging history.")}`,
    "",
    c(BOLD, "Usage"),
    "  kgraph <command> [options]",
    "",
    c(BOLD, "Start"),
    command("init", "Create .kgraph/ workspace"),
    command("init --integrations codex,cursor", "Initialize and connect AI tools"),
    "",
    c(BOLD, "Workflows"),
    command("scan", "Refresh file, symbol, import, and relationship maps"),
    command("context \"auth token refresh\"", "Return compact context for an AI chat"),
    command("update", "Process .kgraph/inbox Markdown cognition notes"),
    "",
    c(BOLD, "Integrations"),
    command("integrate list", "Show configured AI tool integrations"),
    command("integrate add codex copilot", "Write KGraph instructions for AI tools"),
    command("integrate remove cursor", "Remove KGraph-managed instruction blocks"),
    "",
    c(BOLD, "Options"),
    command("-V, --version", "Show version"),
    command("-h, --help", "Show this help"),
    "",
    `${c(YELLOW, "Examples")}`,
    "  kgraph init --integrations codex,copilot,cursor",
    "  kgraph scan",
    "  kgraph context \"blog admin token usage\" --json",
    "",
    c(DIM, "Docs: https://github.com/kentwynn/KGraph#readme"),
    ""
  ].join("\n");
}

function supportsColor(): boolean {
  return Boolean(process.stdout.isTTY) && process.env.NO_COLOR === undefined;
}
