import type { Command } from "commander";
import { writeDefaultConfig } from "../../config/config.js";
import { normalizeIntegrationNames } from "../../integrations/integration-registry.js";
import { addIntegrations } from "../../integrations/integration-store.js";
import { ensureWorkspace } from "../../storage/kgraph-paths.js";
import { runCommand } from "../errors.js";

interface InitOptions {
  integration?: string[];
  integrations?: string;
}

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize a .kgraph workspace")
    .option("--integration <name>", "Configure an AI tool integration", collectOption, [])
    .option("--integrations <names>", "Configure comma-separated AI tool integrations")
    .action((options: InitOptions) =>
      runCommand(async () => {
        const workspace = await ensureWorkspace(process.cwd());
        const wroteConfig = await writeDefaultConfig(workspace);
        console.log(wroteConfig ? "Initialized .kgraph workspace." : ".kgraph workspace already initialized.");

        const names = normalizeIntegrationNames([
          ...(options.integration ?? []),
          ...(options.integrations ? [options.integrations] : [])
        ]);
        if (names.length > 0) {
          const changed = await addIntegrations(workspace, names);
          console.log(`Configured integrations: ${changed.map((item) => item.name).join(", ")}`);
        }
      })
    );
}

function collectOption(value: string, previous: string[]): string[] {
  previous.push(value);
  return previous;
}
