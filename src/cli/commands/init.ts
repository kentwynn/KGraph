import type { Command } from "commander";
import { writeDefaultConfig } from "../../config/config.js";
import { ensureWorkspace } from "../../storage/kgraph-paths.js";
import { runCommand } from "../errors.js";

export function registerInitCommand(program: Command): void {
  program.command("init").description("Initialize a .kgraph workspace").action(() =>
    runCommand(async () => {
      const workspace = await ensureWorkspace(process.cwd());
      const wroteConfig = await writeDefaultConfig(workspace);
      console.log(wroteConfig ? "Initialized .kgraph workspace." : ".kgraph workspace already initialized.");
    })
  );
}
