import type { IntegrationAdapter } from '../integration-registry.js';

export const codexAdapter: IntegrationAdapter = {
  name: 'codex',
  label: 'Codex',
  targetPath: 'AGENTS.md',
  instructions: `## KGraph Workflow

{{KGRAPH_CONTEXT_POLICY}} The /kgraph skill handles the full automated workflow. Run \`kgraph doctor\` when setup or generated maps look wrong. Run \`kgraph scan\`, \`kgraph update\`, and \`kgraph context\` manually only when you need one specific step.
`,
  commandFiles: [
    {
      path: '.agents/skills/kgraph/SKILL.md',
      content: `---
name: kgraph
description: Use KGraph persistent repo intelligence according to the configured integration mode. Use when asked about repo structure, debugging context, architecture decisions, or to avoid rediscovering what is already known.
---

# KGraph Skill

Workflow:

1. Infer the current topic from the user request.
2. {{KGRAPH_CONTEXT_POLICY}}
3. Use KGraph's returned files, symbols, relationships, and cognition as navigation hints.
4. Run \`kgraph doctor\` when setup, maps, inbox processing, or integrations look wrong. Run \`kgraph doctor --quality\` when context shows stale/noisy cognition references.
5. Track meaningful session activity with \`kgraph session start --agent codex\`, \`kgraph session read <path> --agent codex\`, \`kgraph session write <path> --agent codex\`, and \`kgraph session end --agent codex\`.
6. Run \`kgraph impact "<file-or-symbol>"\` when the user asks what a change may affect. Run \`kgraph history "<topic>"\` when prior work or decisions matter.
7. At the end of any session that changed repository files, write one concise Markdown note to \`.kgraph/inbox/<slug>.md\` before finishing.
8. Do not skip capture for UI text, button, link, route, styling, or small file edits. Skip capture only when no repository files changed.
9. Do not run KGraph repeatedly. Run it once at the start with \`kgraph "<topic>"\`. If repo files changed, write the inbox note first, then run \`kgraph\` once at the end.
10. After the final \`kgraph\` run, mention whether the inbox note was processed.
11. Run \`kgraph repair --dry-run\` before cleanup when stale/noisy cognition needs fixing. Run \`kgraph repair\` only when the user asks to apply that cleanup.
12. Run \`kgraph visualize\` when the user wants to inspect the dependency graph — opens an interactive graph at http://localhost:4242 with PNG export.
13. Run \`kgraph history\` or \`kgraph history "<topic>"\` to review past cognition sessions with git author attribution.

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
