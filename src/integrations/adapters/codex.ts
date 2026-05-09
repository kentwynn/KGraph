import type { IntegrationAdapter } from "../integration-registry.js";

export const codexAdapter: IntegrationAdapter = {
  name: "codex",
  label: "Codex",
  targetPath: "AGENTS.md",
  instructions: `## KGraph Workflow

- Before broad repository exploration, run \`kgraph context "<topic>"\` to load current repo intelligence.
- After useful debugging, architecture discovery, workflow learning, or implementation work, write a concise Markdown note into \`.kgraph/inbox/\`.
- Run \`kgraph update\` after adding inbox notes so KGraph preserves durable cognition.
- Run \`kgraph scan\` after file moves, function renames, refactors, or other structural changes.
- When visualization support is available and the developer asks to inspect KGraph, run \`kgraph visualize\` and report the generated local artifact.
`,
  commandFiles: [
    {
      path: ".agents/skills/kgraph/SKILL.md",
      content: `---
name: "kgraph"
description: "Use KGraph persistent repo intelligence for the current coding task."
---

Use this skill when the user asks to use KGraph, requests repo context, or asks you to avoid rediscovering repository structure.

Workflow:

1. Infer the current topic from the user request.
2. Run \`kgraph context "<topic>"\` before broad repo exploration.
3. Use KGraph's files, symbols, relationships, and cognition as navigation hints.
4. After durable discoveries, write a concise Markdown note to \`.kgraph/inbox/\`.
5. Run \`kgraph update\` if you created an inbox note.
6. Run \`kgraph scan\` after structural changes.
`
    }
  ],
  obsoleteCommandFiles: [".agents/skills/kgraph-update", ".agents/skills/kgraph-scan"]
};
