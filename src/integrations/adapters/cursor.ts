import type { IntegrationAdapter } from "../integration-registry.js";

export const cursorAdapter: IntegrationAdapter = {
  name: "cursor",
  label: "Cursor",
  targetPath: ".cursor/rules/kgraph.mdc",
  instructions: `---
description: Use KGraph persistent repo intelligence before broad repository exploration
alwaysApply: true
---

## KGraph Workflow

- Query \`kgraph context "<topic>"\` before broad file searches when repo cognition may already exist.
- Store durable chat, debugging, architecture, and workflow discoveries as Markdown notes in \`.kgraph/inbox/\`.
- Run \`kgraph update\` after adding useful notes.
- Run \`kgraph scan\` after refactors, moved folders, renamed functions, or other structure changes.
- Run \`kgraph visualize\` when asked to inspect the KGraph map.
`
};
