import { agentSkillFiles } from '../agent-skills.js';
import type { IntegrationAdapter } from '../integration-registry.js';

export const codexAdapter: IntegrationAdapter = {
  name: 'codex',
  label: 'Codex',
  targetPath: 'AGENTS.md',
  instructions: `## KGraph Workflow

{{KGRAPH_CONTEXT_POLICY}} The /kgraph skill handles the full automated workflow. Run \`kgraph pack "<task>" --budget 8000 --json\` for a machine-readable token-budgeted context pack, \`kgraph knowledge list\` or \`kgraph knowledge get <atom-id>\` to inspect durable atoms, \`kgraph stale\` and \`kgraph blame <atom-id>\` when lifecycle/provenance matters, \`kgraph conclude\` for durable typed engineering memory, and \`kgraph compact --dry-run\` when cognition looks duplicated or stale. Run \`kgraph doctor\` when setup or generated maps look wrong. Run \`kgraph scan\`, \`kgraph update\`, and \`kgraph context\` manually only when you need one specific step.
`,
  commandFiles: agentSkillFiles('codex'),
  obsoleteCommandFiles: [],
};
