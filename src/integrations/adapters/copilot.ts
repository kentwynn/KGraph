import type { IntegrationAdapter } from '../integration-registry.js';

export const copilotAdapter: IntegrationAdapter = {
  name: 'copilot',
  label: 'GitHub Copilot',
  targetPath: '.github/copilot-instructions.md',
  instructions: `## KGraph Workflow

Before exploring the repository, run \`kgraph context "<topic>"\` to load existing repo intelligence.
After durable discoveries (architecture decisions, debugging insights, structural findings), write a concise Markdown note to \`.kgraph/inbox/\` and immediately run \`kgraph update\`.
If you created, moved, deleted, or renamed files or symbols, run \`kgraph scan\`.
Use /kgraph for the full automated workflow. Use /kgraph-scan, /kgraph-update, /kgraph-visualize, and /kgraph-history for manual steps.
`,
  commandFiles: [
    {
      path: '.github/prompts/kgraph.prompt.md',
      content: `---
description: Use KGraph persistent repo intelligence for the current coding task
agent: agent
---

Use KGraph persistent repo intelligence for the current request.

1. Infer the topic from the user's request.
2. Run \`kgraph context "<topic>"\`.
3. Use the returned files, symbols, relationships, and cognition before broad exploration.
4. After durable discoveries, write a concise Markdown note to \`.kgraph/inbox/\` and immediately run \`kgraph update\`.
5. If you created, moved, deleted, or renamed files or symbols during this session, run \`kgraph scan\`. Skip it otherwise.
6. Run \`kgraph visualize\` when the user wants to inspect the dependency graph — opens an interactive graph at http://localhost:4242 with PNG export.
7. Run \`kgraph history\` to review the timeline of past cognition sessions with git author attribution.
`,
    },
    {
      path: '.github/prompts/kgraph-scan.prompt.md',
      content: `---
description: Refresh KGraph file, symbol, import, and relationship maps
agent: agent
---

Run \`kgraph scan\` to refresh the repository maps, then summarize what changed.
`,
    },
    {
      path: '.github/prompts/kgraph-update.prompt.md',
      content: `---
description: Process KGraph inbox notes into durable cognition
agent: agent
---

Run \`kgraph update\` to process any pending Markdown notes in \`.kgraph/inbox/\` into durable cognition.
`,
    },
    {
      path: '.github/prompts/kgraph-visualize.prompt.md',
      content: `---
description: Open interactive KGraph dependency graph in browser
agent: agent
---

Run \`kgraph visualize\` to start the interactive dependency graph at http://localhost:4242, then summarize what nodes and connections are visible.
`,
    },
    {
      path: '.github/prompts/kgraph-history.prompt.md',
      content: `---
description: Show timeline of KGraph cognition sessions with git attribution
agent: agent
---

Run \`kgraph history\` to display the timeline of all processed cognition sessions. Summarize who contributed what and when. Use \`--last <n>\` to limit entries.
`,
    },
  ],
  obsoleteCommandFiles: [],
};
