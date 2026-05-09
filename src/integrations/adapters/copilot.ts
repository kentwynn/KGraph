import type { IntegrationAdapter } from '../integration-registry.js';

export const copilotAdapter: IntegrationAdapter = {
  name: 'copilot',
  label: 'GitHub Copilot',
  targetPath: '.github/copilot-instructions.md',
  instructions: `## KGraph Workflow

Before exploring the repository, run \`kgraph context "<topic>"\` to load existing repo intelligence. Use /kgraph-scan and /kgraph-update for manual maintenance.
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
    {
      path: '.github/prompts/kgraph-visualize.prompt.md',
      content: `---
mode: agent
description: Open interactive KGraph dependency graph in browser
---

Run \`kgraph visualize\` to start the interactive dependency graph at http://localhost:4242, then summarize what nodes and connections are visible.
`,
    },
  ],
  obsoleteCommandFiles: ['.github/prompts/kgraph.prompt.md'],
};
