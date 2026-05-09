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

- **Before exploring the repository**, run \`kgraph context "<topic>"\` to load existing repo intelligence. Use the returned files, symbols, and cognition before any broad exploration.
- **After completing work**, write a Markdown note to \`.kgraph/inbox/<slug>.md\` (title, Key Files, Key Symbols, Decisions sections) **only if** you discovered something a future session would need to re-derive — a gotcha, constraint, non-obvious decision, or bug. Skip capture for read-only reviews or sessions where nothing new was found. When you do capture, immediately run \`kgraph update\`.
- If you created, moved, deleted, or renamed files or symbols, run \`kgraph scan\`.
- Run \`kgraph visualize\` to open the interactive dependency graph at http://localhost:4242 with PNG export.
- Run \`kgraph history\` to review the timeline of past cognition sessions with git author attribution.
`,
  obsoleteCommandFiles: ['.cursor/rules/kgraph-commands.mdc'],
};
