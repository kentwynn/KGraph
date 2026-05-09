import type { IntegrationAdapter } from '../integration-registry.js';

export const codexAdapter: IntegrationAdapter = {
  name: 'codex',
  label: 'Codex',
  targetPath: 'AGENTS.md',
  instructions: `## KGraph Workflow

- Before broad repository exploration, run \`kgraph context "<topic>"\` to load current repo intelligence.
- After useful debugging, architecture discovery, workflow learning, or implementation work, write a concise Markdown note into \`.kgraph/inbox/\` and immediately run \`kgraph update\`.
- If you created, moved, deleted, or renamed any files or symbols during this session, run \`kgraph scan\`. Skip it if you only read files or wrote cognition notes.
- When visualization support is available and the developer asks to inspect KGraph, run \`kgraph visualize\` and report the generated local artifact.
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
`,
    },
  ],
  obsoleteCommandFiles: [
    '.agents/skills/kgraph-update',
    '.agents/skills/kgraph-scan',
  ],
};
