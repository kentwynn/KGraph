import type { IntegrationAdapter } from "../integration-registry.js";

export const claudeCodeAdapter: IntegrationAdapter = {
  name: "claude-code",
  label: "Claude Code",
  targetPath: "CLAUDE.md",
  instructions: `## KGraph Workflow

- Start repository work by checking \`kgraph context "<topic>"\` when the user asks about a domain, bug, workflow, or feature.
- Convert stable discoveries from chat into Markdown notes under \`.kgraph/inbox/\`.
- Run \`kgraph update\` to preserve those notes as durable cognition.
- Run \`kgraph scan\` after structural code changes.
- Run \`kgraph visualize\` when the user wants to inspect the current knowledge map.
`
};
