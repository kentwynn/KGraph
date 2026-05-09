import type { IntegrationAdapter } from '../integration-registry.js';

export const claudeCodeAdapter: IntegrationAdapter = {
  name: 'claude-code',
  label: 'Claude Code',
  targetPath: 'CLAUDE.md',
  instructions: `## KGraph Workflow

- Start repository work by checking \`kgraph context "<topic>"\` when the user asks about a domain, bug, workflow, or feature.
- Convert stable discoveries from chat into Markdown notes under \`.kgraph/inbox/\`.
- Run \`kgraph update\` to preserve those notes as durable cognition.
- Run \`kgraph scan\` after structural code changes.
- Run \`kgraph visualize\` when visualization support is available and the user wants to inspect the current knowledge map.
`,
  commandFiles: [
    {
      path: '.claude/commands/kgraph.md',
      content: `Use KGraph persistent repo intelligence for the current request.

1. Infer the topic from the user's request.
2. Run \`kgraph context "<topic>"\`.
3. Use the returned files, symbols, relationships, and cognition before broad exploration.
4. Save durable discoveries to \`.kgraph/inbox/\` and run \`kgraph update\` when appropriate.
5. Run \`kgraph scan\` after structural changes and report the scan summary.
`,
    },
    {
      path: '.claude/commands/kgraph-scan.md',
      content: `Run \`kgraph scan\` to refresh the repository maps, then summarize what changed.
`,
    },
    {
      path: '.claude/commands/kgraph-update.md',
      content: `Run \`kgraph update\` to process any pending Markdown notes in \`.kgraph/inbox/\` into durable cognition.
`,
    },
  ],
  obsoleteCommandFiles: [],
};
