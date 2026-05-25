import { agentSkillFiles } from '../agent-skills.js';
import type { IntegrationAdapter } from '../integration-registry.js';
import { numberedWorkflow } from '../workflow-steps.js';

export const copilotAdapter: IntegrationAdapter = {
  name: 'copilot',
  label: 'GitHub Copilot',
  targetPath: '.github/copilot-instructions.md',
  instructions: `## KGraph Workflow

${numberedWorkflow('copilot')}
`,
  commandFiles: [
    ...agentSkillFiles('copilot'),
    {
      path: '.github/agents/kgraph.agent.md',
      content: `---
description: Use KGraph persistent repo intelligence — runs kgraph before answering to provide file maps, symbols, relationships, and durable knowledge atoms.
---

## KGraph Workflow

${numberedWorkflow('copilot')}
`,
    },
  ],
  obsoleteCommandFiles: [],
};
