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
  ],
  obsoleteCommandFiles: [
    '.agents/skills/kgraph-update',
    '.agents/skills/kgraph-scan',
  ],
};
