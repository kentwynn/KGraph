import { agentSkillFiles } from '../agent-skills.js';
import type { IntegrationAdapter } from '../integration-registry.js';
import { bulletWorkflow } from '../workflow-steps.js';

export const clineAdapter: IntegrationAdapter = {
  name: 'cline',
  label: 'Cline',
  targetPath: '.clinerules/kgraph.md',
  instructions: `# KGraph Workflow

${bulletWorkflow('cline')}
`,
  commandFiles: agentSkillFiles('cline'),
};
