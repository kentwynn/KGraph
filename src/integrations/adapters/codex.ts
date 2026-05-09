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
    },
    {
      path: ".agents/skills/kgraph-update/SKILL.md",
      content: `---
name: "kgraph-update"
description: "Preserve useful chat discoveries into KGraph cognition."
---

Use this skill when the user asks to update KGraph memory or preserve what was learned.

Write a concise Markdown note under \`.kgraph/inbox/\` with durable architecture, debugging, workflow, file, symbol, or gotcha knowledge. Then run \`kgraph update\`.
`
    },
    {
      path: ".agents/skills/kgraph-scan/SKILL.md",
      content: `---
name: "kgraph-scan"
description: "Refresh KGraph structural maps after code changes."
---

Run \`kgraph scan\` after files move, functions are renamed, folders are refactored, or dependencies change. Report the scan summary and any obvious exclude/config problems.
`
    }
  ]
};
