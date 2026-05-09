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

- Before exploring the repository, run \`kgraph context "<topic>"\` to load existing repo intelligence.
- After durable discoveries (architecture decisions, debugging insights, structural findings), write a concise Markdown note to \`.kgraph/inbox/\` and immediately run \`kgraph update\`.
- If you created, moved, deleted, or renamed files or symbols, run \`kgraph scan\`.
- Run \`kgraph visualize\` to open the interactive dependency graph at http://localhost:4242 with PNG export.
- Run \`kgraph history\` to review the timeline of past cognition sessions with git author attribution.
`,
  obsoleteCommandFiles: ['.cursor/rules/kgraph-commands.mdc'],
};
