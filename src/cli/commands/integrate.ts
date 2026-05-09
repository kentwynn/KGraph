import type { Command } from "commander";
import { addIntegrations, listIntegrations, removeIntegrations } from "../../integrations/integration-store.js";
import { normalizeIntegrationNames } from "../../integrations/integration-registry.js";
import { assertWorkspace } from "../../storage/kgraph-paths.js";
import { KGraphError, runCommand } from "../errors.js";

export function registerIntegrateCommand(program: Command): void {
  const integrate = program.command("integrate").description("Manage AI tool integrations");

  integrate.command("list").description("List configured integrations").action(() =>
    runCommand(async () => {
      const workspace = await assertWorkspace(process.cwd());
      const integrations = await listIntegrations(workspace);
      if (integrations.length === 0) {
        console.log("No integrations configured.");
        return;
      }
      for (const integration of integrations) {
        console.log(
          `${integration.name} ${integration.enabled ? "enabled" : "disabled"} ${integration.targetPath} ${integration.targetExists ? "present" : "missing"}`
        );
      }
    })
  );

  integrate.command("add").description("Add AI tool integrations").argument("<names...>").action((names: string[]) =>
    runCommand(async () => {
      const workspace = await assertWorkspace(process.cwd());
      const normalized = normalizeIntegrationNames(names);
      if (normalized.length === 0) {
        throw new KGraphError("Provide at least one integration name.");
      }
      const changed = await addIntegrations(workspace, normalized);
      console.log(`Configured integrations: ${changed.map((item) => item.name).join(", ")}`);
    })
  );

  integrate.command("remove").description("Remove AI tool integrations").argument("<names...>").action((names: string[]) =>
    runCommand(async () => {
      const workspace = await assertWorkspace(process.cwd());
      const normalized = normalizeIntegrationNames(names);
      if (normalized.length === 0) {
        throw new KGraphError("Provide at least one integration name.");
      }
      const removed = await removeIntegrations(workspace, normalized);
      console.log(`Removed integrations: ${removed.join(", ")}`);
    })
  );
}
