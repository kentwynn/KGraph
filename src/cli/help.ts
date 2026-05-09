import { Chalk } from "chalk";
import figlet from "figlet";

export function renderRootHelp(useColor = supportsColor()): string {
  const theme = new Chalk({ level: useColor ? 3 : 0 });
  const command = (name: string, description: string) => `  ${theme.green(name.padEnd(30))} ${description}`;
  const logo = renderLogo();

  return [
    "",
    theme.hex("#7dd3fc").bold(logo),
    "",
    `  ${theme.bold("KGraph")} ${theme.dim("Persistent repo intelligence for AI coding tools")}`,
    "",
    `  ${theme.hex("#c084fc")("Build a local knowledge layer that helps Codex, Copilot, Cursor,")}`,
    `  ${theme.hex("#c084fc")("and Claude Code reuse repo structure, decisions, and debugging history.")}`,
    "",
    theme.bold("Usage"),
    "  kgraph <command> [options]",
    "",
    theme.bold("Start"),
    command("init", "Create .kgraph/ workspace"),
    command("init --integrations codex,cursor", "Initialize and connect AI tools"),
    "",
    theme.bold("Workflows"),
    command("scan", "Refresh file, symbol, import, and relationship maps"),
    command("context \"auth token refresh\"", "Return compact context for an AI chat"),
    command("update", "Process .kgraph/inbox Markdown cognition notes"),
    "",
    theme.bold("Integrations"),
    command("integrate list", "Show configured AI tool integrations"),
    command("integrate add codex copilot", "Write KGraph instructions for AI tools"),
    command("integrate remove cursor", "Remove KGraph-managed instruction blocks"),
    "",
    theme.bold("Options"),
    command("-V, --version", "Show version"),
    command("-h, --help", "Show this help"),
    "",
    `${theme.yellow("Examples")}`,
    "  kgraph init --integrations codex,copilot,cursor",
    "  kgraph scan",
    "  kgraph context \"blog admin token usage\" --json",
    "",
    theme.dim("Docs: https://github.com/kentwynn/KGraph#readme"),
    ""
  ].join("\n");
}

function renderLogo(): string {
  try {
    return figlet.textSync("KGraph", {
      font: "ANSI Shadow",
      horizontalLayout: "default",
      verticalLayout: "default"
    });
  } catch {
    return "KGraph";
  }
}

function supportsColor(): boolean {
  return Boolean(process.stdout.isTTY) && process.env.NO_COLOR === undefined;
}
