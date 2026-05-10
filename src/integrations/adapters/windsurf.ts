import type { IntegrationAdapter } from '../integration-registry.js';

export const windsurfAdapter: IntegrationAdapter = {
  name: 'windsurf',
  label: 'Windsurf',
  targetPath: '.windsurf/rules/kgraph.md',
  instructions: `# KGraph Workflow

- {{KGRAPH_CONTEXT_POLICY}}
- Run \`kgraph doctor\` when setup, maps, inbox processing, or integrations look wrong. Run \`kgraph doctor --quality\` when context shows stale/noisy cognition references.
- Track meaningful session activity with \`kgraph session start --agent windsurf\`, \`kgraph session read <path> --agent windsurf\`, \`kgraph session write <path> --agent windsurf\`, and \`kgraph session end --agent windsurf\`.
- Run \`kgraph impact "<file-or-symbol>"\` when the user asks what a change may affect. Run \`kgraph history "<topic>"\` when prior work or decisions matter.
- At the end of any session that changed repository files, write one concise Markdown note to \`.kgraph/inbox/<slug>.md\` before finishing.
- Do not skip capture for UI text, button, link, route, styling, or small file edits. Skip capture only when no repository files changed.
- Do not run KGraph repeatedly. Run it once at the start with \`kgraph "<topic>"\`. If repo files changed, write the inbox note first, then run \`kgraph\` once at the end.
- After the final \`kgraph\` run, mention whether the inbox note was processed.
- Run \`kgraph repair --dry-run\` before cleanup when stale/noisy cognition needs fixing. Run \`kgraph repair\` only when the user asks to apply that cleanup.
- Run \`kgraph visualize\` to open the interactive dependency graph at http://localhost:4242 with PNG export.
- Run \`kgraph history\` or \`kgraph history "<topic>"\` to review past cognition sessions with git author attribution.
`,
};
