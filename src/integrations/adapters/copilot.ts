import type { IntegrationAdapter } from '../integration-registry.js';

export const copilotAdapter: IntegrationAdapter = {
  name: 'copilot',
  label: 'GitHub Copilot',
  targetPath: '.github/copilot-instructions.md',
  instructions: `## KGraph Workflow

- Use \`kgraph context "<topic>"\` before scanning many files manually.
- After stable findings, write a Markdown note to \`.kgraph/inbox/\` and immediately run \`kgraph update\`.
- If you created, moved, deleted, or renamed any files or symbols during this session, run \`kgraph scan\`. Skip it if you only read files or wrote cognition notes.
- Use \`kgraph visualize\` when visualization support is available and the developer asks to inspect the repository knowledge map.
`,
  commandFiles: [
    {
      path: '.github/prompts/kgraph-scan.prompt.md',
      content: `---
mode: agent
description: Refresh KGraph file, symbol, import, and relationship maps
---

Run \`kgraph scan\` to refresh the repository maps, then summarize what changed.
`,
    },
    {
      path: '.github/prompts/kgraph-update.prompt.md',
      content: `---
mode: agent
description: Process KGraph inbox notes into durable cognition
---

Run \`kgraph update\` to process any pending Markdown notes in \`.kgraph/inbox/\` into durable cognition.
`,
    },
  ],
  obsoleteCommandFiles: ['.github/prompts/kgraph.prompt.md'],
};
