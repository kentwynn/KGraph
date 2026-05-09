import type { IntegrationAdapter } from '../integration-registry.js';

export const codexAdapter: IntegrationAdapter = {
  name: 'codex',
  label: 'Codex',
  targetPath: 'AGENTS.md',
  instructions: `## KGraph Workflow

Before exploring the repository, run \`kgraph context "<topic>"\` to load existing repo intelligence. The /kgraph skill handles the full automated workflow. Run \`kgraph scan\` and \`kgraph update\` manually when needed.
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
2. Run \`kgraph context "<topic>"\` before broad repo exploration.
3. Use KGraph's returned files, symbols, relationships, and cognition as navigation hints.
4. After durable discoveries, write a concise Markdown note to \`.kgraph/inbox/\` and immediately run \`kgraph update\`.
5. If you created, moved, deleted, or renamed files or symbols during this session, run \`kgraph scan\`. Skip it otherwise.
6. Run \`kgraph visualize\` when the user wants to inspect the dependency graph — opens an interactive graph at http://localhost:4242 with PNG export.
7. Run \`kgraph history\` to review the timeline of past cognition sessions with git author attribution.
`,
    },
  ],
  obsoleteCommandFiles: [
    '.agents/skills/kgraph-update',
    '.agents/skills/kgraph-scan',
  ],
};
