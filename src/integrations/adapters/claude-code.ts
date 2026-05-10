import type { IntegrationAdapter } from '../integration-registry.js';

export const claudeCodeAdapter: IntegrationAdapter = {
  name: 'claude-code',
  label: 'Claude Code',
  targetPath: 'CLAUDE.md',
  instructions: `## KGraph Workflow

Before exploring the repository, run \`kgraph "<topic>"\` to refresh repo intelligence and load focused context. Use /kgraph for the full automated workflow. Run \`kgraph doctor\` when setup or generated maps look wrong. Run \`kgraph scan\`, \`kgraph update\`, and \`kgraph context\` manually only when you need one specific step.
`,
  commandFiles: [
    {
      path: '.claude/commands/kgraph.md',
      content: `Use KGraph persistent repo intelligence for the current request.

1. Infer the topic from the user's request.
2. Run \`kgraph "<topic>"\`. This refreshes maps, processes pending inbox notes, and returns focused context in one command.
3. Use the returned files, symbols, relationships, and cognition before broad exploration.
4. Run \`kgraph doctor\` when setup, maps, inbox processing, or integrations look wrong.
5. At the end of any session that changed repository files, check the KGraph capture workflow before finishing.
6. If the file change has future value, write one concise Markdown note to \`.kgraph/inbox/<slug>.md\`; otherwise explicitly skip capture as trivial.
7. Skip capture only for read-only work, trivial formatting, typo-only docs, dependency-only churn, mechanical cleanup with no future value, or sessions where no repo files changed.
8. Do not run KGraph repeatedly. Run it once at the start with \`kgraph "<topic>"\`. If repo files changed, write any needed inbox note first, then run \`kgraph\` once at the end.
9. Run \`kgraph visualize\` when the user wants to inspect the dependency graph — opens an interactive graph at http://localhost:4242 with PNG export.
10. Run \`kgraph history\` to review the timeline of past cognition sessions with git author attribution.

The inbox note must use this structure:
\`\`\`markdown
# <Short Title>

## Summary
One or two sentences describing the durable change or finding.

## Key Files
- \`path/to/file.ts\` — what changed or why it matters

## Key Symbols
- \`FunctionName\` — what changed or why it matters

## Decisions
Any implementation or product decision future sessions should know.
\`\`\`
`,
    },
    {
      path: '.claude/commands/kgraph-doctor.md',
      content: `Run \`kgraph doctor\` to check whether the workspace is initialized, maps exist, inbox notes are pending, and configured integrations point to real files. Summarize any failed checks and the next command to run.
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
    {
      path: '.claude/commands/kgraph-visualize.md',
      content: `Run \`kgraph visualize\` to start an interactive dependency graph at http://localhost:4242. Opens in browser automatically. Use \`--no-open\` to print URL only, \`--port <n>\` for a custom port.
`,
    },
    {
      path: '.claude/commands/kgraph-history.md',
      content: `Run \`kgraph history\` to show a timeline of all processed cognition sessions. Includes git author attribution when available. Use \`--last <n>\` to limit entries, \`--json\` for machine-readable output.
`,
    },
  ],
  obsoleteCommandFiles: [],
};
