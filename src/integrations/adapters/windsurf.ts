import type { IntegrationAdapter } from '../integration-registry.js';

export const windsurfAdapter: IntegrationAdapter = {
  name: 'windsurf',
  label: 'Windsurf',
  targetPath: '.windsurf/rules/kgraph.md',
  instructions: `# KGraph Workflow

- **Before exploring the repository**, run \`kgraph "<topic>"\` to refresh maps, process pending inbox notes, and load focused repo intelligence. Use the returned files, symbols, relationships, and cognition before any broad exploration.
- Run \`kgraph doctor\` when setup, maps, inbox processing, or integrations look wrong. Run \`kgraph doctor --quality\` when context shows stale/noisy cognition references.
- At the end of any session that changed repository files, check the KGraph capture workflow before finishing.
- If the file change has future value, write one concise Markdown note to \`.kgraph/inbox/<slug>.md\`; otherwise explicitly skip capture as trivial.
- Skip capture only for read-only work, trivial formatting, typo-only docs, dependency-only churn, mechanical cleanup with no future value, or sessions where no repo files changed.
- Do not run KGraph repeatedly. Run it once at the start with \`kgraph "<topic>"\`. If repo files changed, write any needed inbox note first, then run \`kgraph\` once at the end.
- Run \`kgraph repair --dry-run\` before cleanup when stale/noisy cognition needs fixing. Run \`kgraph repair\` only when the user asks to apply that cleanup.
- Run \`kgraph visualize\` to open the interactive dependency graph at http://localhost:4242 with PNG export.
- Run \`kgraph history\` to review the timeline of past cognition sessions with git author attribution.
`,
};
