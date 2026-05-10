import type { Command } from "commander";
import { loadConfig } from "../../config/config.js";
import { queryContext } from "../../context/context-query.js";
import { assertWorkspace } from "../../storage/kgraph-paths.js";
import { mapsExist, readMaps } from "../../storage/map-store.js";
import type { ContextResponse } from "../../types/cognition.js";
import { KGraphError, runCommand } from "../errors.js";

export function registerContextCommand(program: Command): void {
  program
    .command("context <query>")
    .description("Return compact repo context for a query")
    .option("--json", "Print JSON output")
    .action((query: string, options: { json?: boolean }) =>
      runCommand(async () => {
        if (!query.trim()) {
          throw new KGraphError("Query cannot be empty.");
        }
        const workspace = await assertWorkspace(process.cwd());
        if (!(await mapsExist(workspace))) {
          throw new KGraphError("KGraph maps are missing. Run `kgraph scan` first.");
        }
        const config = await loadConfig(workspace);
        const maps = await readMaps(workspace);
        const response = await queryContext(workspace, config, maps, query);
        console.log(options.json ? JSON.stringify(response, null, 2) : renderContextMarkdown(response));
      })
    );
}

export function renderContextMarkdown(response: ContextResponse): string {
  const lines = [`# KGraph Context`, ``, `Query: ${response.query}`, ``];
  lines.push("## Matched Domains", "");
  lines.push(...formatList(response.matchedDomains.map((item) => `- ${item.item.name} (${item.reasons.join(", ")})`)));
  lines.push("", "## Relevant Files", "");
  lines.push(...formatList(response.relevantFiles.map((item) => `- ${item.item.path} (${item.reasons.join(", ")})`)));
  lines.push("", "## Relevant Symbols", "");
  lines.push(...formatList(response.relevantSymbols.map((item) => `- ${item.item.name} in ${item.item.filePath}`)));
  lines.push("", "## Relevant Cognition", "");
  lines.push(...formatList(response.relevantCognition.map((item) => `- ${item.item.title} [${item.item.referencesStatus}]`)));
  lines.push("", "## Relationships", "");
  lines.push(
    ...formatList(response.relationships.map(
      (relationship) =>
        `- ${relationship.sourceId} ${relationship.relationshipType} ${relationship.targetId} (${relationship.confidence})`
    ))
  );
  lines.push("", "## Stale References", "");
  lines.push(...formatList(response.staleReferences.map((ref) => `- ${ref}`)));
  return lines.join("\n");
}

function formatList(items: string[]): string[] {
  return items.length > 0 ? items : ["- None"];
}
