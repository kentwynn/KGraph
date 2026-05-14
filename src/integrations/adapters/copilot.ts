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
  commandFiles: agentSkillFiles('copilot'),
  obsoleteCommandFiles: [],
};
