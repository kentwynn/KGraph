import type { IntegrationAdapter } from '../integration-registry.js';

export const cursorAdapter: IntegrationAdapter = {
  name: 'cursor',
  label: 'Cursor',
  targetPath: '.cursor/rules/kgraph.mdc',
  instructions: `---
description: Use KGraph persistent repo intelligence before broad repository exploration
alwaysApply: true
---

## KGraph Workflow

- Query \`kgraph context "<topic>"\` before broad file searches when repo cognition may already exist.
- Store durable chat, debugging, architecture, and workflow discoveries as Markdown notes in \`.kgraph/inbox/\` and immediately run \`kgraph update\`.
- If you created, moved, deleted, or renamed any files or symbols during this session, run \`kgraph scan\`. Skip it if you only read files or wrote cognition notes.
- Run \`kgraph visualize\` when visualization support is available and the developer asks to inspect the KGraph map.
`,
  obsoleteCommandFiles: ['.cursor/rules/kgraph-commands.mdc'],
};
