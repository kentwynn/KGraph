import type { IntegrationAdapter } from '../integration-registry.js';

export const copilotAdapter: IntegrationAdapter = {
  name: 'copilot',
  label: 'GitHub Copilot',
  targetPath: '.github/copilot-instructions.md',
  instructions: `## KGraph Workflow

1. **Before exploring the repository**, run \`kgraph context "<topic>"\` to load existing repo intelligence. Use the returned files, symbols, and cognition before any broad exploration.
2. **After every meaningful implementation or discovery session**, write a Markdown note to \`.kgraph/inbox/<slug>.md\` capturing what was built, which files were touched, which symbols matter, and any decisions made. Then immediately run \`kgraph update\`.
3. If you created, moved, deleted, or renamed files or symbols, run \`kgraph scan\`.

The inbox note must use this structure:
\`\`\`markdown
# <Short Title>

## Summary
One or two sentences describing what was done.

## Key Files
- \`path/to/file.ts\` — what it does

## Key Symbols
- \`FunctionName\` — what it does

## Decisions
Any architectural or implementation decisions made.
\`\`\`
`,
  commandFiles: [
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
  obsoleteCommandFiles: ['.github/prompts/kgraph.prompt.md'],
};
