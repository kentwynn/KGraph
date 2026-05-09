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

Before exploring the repository, run \`kgraph context "<topic>"\` to load existing repo intelligence. Run \`kgraph scan\` and \`kgraph update\` manually when needed. Run \`kgraph visualize\` to open the interactive dependency graph at http://localhost:4242.
`,
  obsoleteCommandFiles: ['.cursor/rules/kgraph-commands.mdc'],
};
