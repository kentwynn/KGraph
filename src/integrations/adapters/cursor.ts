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

- {{KGRAPH_CONTEXT_POLICY}}
- Run \`kgraph doctor\` when setup, maps, inbox processing, or integrations look wrong. Run \`kgraph doctor --quality\` when context shows stale/noisy cognition references.
- Track meaningful session activity with \`kgraph session start --agent cursor\`, \`kgraph session read <path> --agent cursor\`, \`kgraph session write <path> --agent cursor\`, and \`kgraph session end --agent cursor\`.
- Run \`kgraph impact "<file-or-symbol>"\` when the user asks what a change may affect. Run \`kgraph history "<topic>"\` when prior work or decisions matter.
{{KGRAPH_CAPTURE_POLICY}}
- Run \`kgraph repair --dry-run\` before cleanup when stale/noisy cognition needs fixing. Run \`kgraph repair\` only when the user asks to apply that cleanup.
- Run \`kgraph visualize\` to open the interactive dependency graph at http://localhost:4242 with PNG export.
- Run \`kgraph history\` or \`kgraph history "<topic>"\` to review past cognition sessions with git author attribution.
`,
  obsoleteCommandFiles: ['.cursor/rules/kgraph-commands.mdc'],
};
