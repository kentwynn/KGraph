import type { IntegrationAdapter } from '../integration-registry.js';

export const codexAdapter: IntegrationAdapter = {
  name: 'codex',
  label: 'Codex',
  targetPath: 'AGENTS.md',
  instructions: `## KGraph Workflow

Before exploring the repository, run \`kgraph "<topic>"\` to refresh repo intelligence and load focused context. The /kgraph skill handles the full automated workflow. Run \`kgraph doctor\` when setup or generated maps look wrong. Run \`kgraph scan\`, \`kgraph update\`, and \`kgraph context\` manually only when you need one specific step.
`,
  commandFiles: [
    {
      path: '.agents/skills/kgraph/SKILL.md',
      content: `---
name: kgraph
description: Use KGraph persistent repo intelligence before broad repository exploration. Use when asked about repo structure, debugging context, architecture decisions, or to avoid rediscovering what is already known.
---

# KGraph Skill

Workflow:

1. Infer the current topic from the user request.
2. Run \`kgraph "<topic>"\` before broad repo exploration. This refreshes maps, processes pending inbox notes, and returns focused context in one command.
3. Use KGraph's returned files, symbols, relationships, and cognition as navigation hints.
4. Run \`kgraph doctor\` when setup, maps, inbox processing, or integrations look wrong.
5. **After completing the work**, write a Markdown note to \`.kgraph/inbox/<slug>.md\` **only if** you discovered something a future session would need to re-derive — a gotcha, constraint, non-obvious decision, or bug. Skip capture for read-only reviews or sessions where nothing new was found. When you do capture, immediately run \`kgraph update\` or simply run \`kgraph\`.
6. If you created, moved, deleted, or renamed files or symbols during this session, run \`kgraph\` or \`kgraph scan\`. Skip it otherwise.
7. Run \`kgraph visualize\` when the user wants to inspect the dependency graph — opens an interactive graph at http://localhost:4242 with PNG export.
8. Run \`kgraph history\` to review the timeline of past cognition sessions with git author attribution.

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
  ],
  obsoleteCommandFiles: [
    '.agents/skills/kgraph-update',
    '.agents/skills/kgraph-scan',
  ],
};
