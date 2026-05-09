import type { Command } from "commander";
import { updateCognition } from "../../cognition/cognition-updater.js";
import { assertWorkspace } from "../../storage/kgraph-paths.js";
import { readMaps } from "../../storage/map-store.js";
import { runCommand } from "../errors.js";

export function registerUpdateCommand(program: Command): void {
  program
    .command("update")
    .description("Process Markdown cognition notes from .kgraph/inbox")
    .option("--dry-run", "Parse notes without writing cognition files")
    .action((options: { dryRun?: boolean }) =>
      runCommand(async () => {
        const workspace = await assertWorkspace(process.cwd());
        const maps = await readMaps(workspace);
        const result = await updateCognition(
          workspace,
          { files: maps.fileMap.files, symbols: maps.symbolMap.symbols },
          Boolean(options.dryRun)
        );
        console.log(`${options.dryRun ? "Parsed" : "Processed"} ${result.processed.length} cognition notes.`);
        for (const warning of result.warnings) {
          console.warn(`Warning: ${warning}`);
        }
      })
    );
}
