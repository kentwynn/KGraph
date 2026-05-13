import type { IntegrationAdapter } from '../integration-registry.js';
import { numberedWorkflow } from '../workflow-steps.js';

export const codexAdapter: IntegrationAdapter = {
  name: 'codex',
  label: 'Codex',
  targetPath: 'AGENTS.md',
  instructions: `## KGraph Workflow

{{KGRAPH_CONTEXT_POLICY}} The /kgraph skill handles the full automated workflow. Run \`kgraph conclude\` for durable typed engineering memory and \`kgraph compact --dry-run\` when cognition looks duplicated or stale. Run \`kgraph doctor\` when setup or generated maps look wrong. Run \`kgraph scan\`, \`kgraph update\`, and \`kgraph context\` manually only when you need one specific step.
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

${numberedWorkflow('codex')}
`,
    },
  ],
  obsoleteCommandFiles: [
    '.agents/skills/kgraph-scan/SKILL.md',
    '.agents/skills/kgraph-update/SKILL.md',
  ],
};
