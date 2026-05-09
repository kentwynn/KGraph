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
- When asked to inspect KGraph, run \`kgraph visualize\` and report the generated local artifact.
`
};
