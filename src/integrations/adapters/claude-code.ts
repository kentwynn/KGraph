import type { IntegrationAdapter } from '../integration-registry.js';

export const claudeCodeAdapter: IntegrationAdapter = {
  name: 'claude-code',
  label: 'Claude Code',
  targetPath: 'CLAUDE.md',
  instructions: `## KGraph Workflow

Before exploring the repository, run \`kgraph context "<topic>"\` to load existing repo intelligence. Use /kgraph for the full automated workflow. Run \`kgraph scan\` and \`kgraph update\` manually when needed.
`,
  commandFiles: [
    {
      path: '.claude/commands/kgraph.md',
      content: `Use KGraph persistent repo intelligence for the current request.

1. Infer the topic from the user's request.
2. Run \`kgraph context "<topic>"\`.
3. Use the returned files, symbols, relationships, and cognition before broad exploration.
4. **After completing the work**, write a Markdown note to \`.kgraph/inbox/<slug>.md\` **only if** you discovered something a future session would need to re-derive — a gotcha, constraint, non-obvious decision, or bug. Skip capture for read-only reviews or sessions where nothing new was found. When you do capture, immediately run \`kgraph update\`.
5. If you created, moved, deleted, or renamed files or symbols during this session, run \`kgraph scan\` and report the summary. Skip it otherwise.
6. Run \`kgraph visualize\` when the user wants to inspect the dependency graph — opens an interactive graph at http://localhost:4242 with PNG export.
7. Run \`kgraph history\` to review the timeline of past cognition sessions with git author attribution.

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
