import { agentSkillFiles } from '../agent-skills.js';
import type { IntegrationAdapter } from '../integration-registry.js';
import { numberedWorkflow } from '../workflow-steps.js';

export const codexAdapter: IntegrationAdapter = {
  name: 'codex',
  label: 'Codex',
  targetPath: 'AGENTS.md',
  instructions: `## KGraph Workflow

${numberedWorkflow('codex')}
`,
  commandFiles: agentSkillFiles('codex'),
  obsoleteCommandFiles: [],
};
