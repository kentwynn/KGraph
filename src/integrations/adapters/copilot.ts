import type { IntegrationAdapter } from "../integration-registry.js";

export const copilotAdapter: IntegrationAdapter = {
  name: "copilot",
  label: "GitHub Copilot",
  targetPath: ".github/copilot-instructions.md",
  instructions: `## KGraph Workflow

- Use \`kgraph context "<topic>"\` before scanning many files manually.
- Preserve stable findings by creating Markdown notes in \`.kgraph/inbox/\`.
- Use \`kgraph update\` to process chat summaries and debugging conclusions into durable cognition.
- Use \`kgraph scan\` when code structure changes.
- Use \`kgraph visualize\` when visualization support is available and the developer asks to inspect the repository knowledge map.
`
};
