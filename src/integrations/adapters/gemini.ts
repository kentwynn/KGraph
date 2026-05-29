import { agentSkillFiles } from '../agent-skills.js';
import type { IntegrationAdapter } from '../integration-registry.js';
import { numberedWorkflow } from '../workflow-steps.js';

export const geminiAdapter: IntegrationAdapter = {
  name: 'gemini',
  label: 'Gemini CLI',
  targetPath: 'GEMINI.md',
  instructions: `## KGraph Workflow

${numberedWorkflow('gemini')}
`,
  commandFiles: agentSkillFiles('gemini'),
  obsoleteCommandFiles: [],
};
