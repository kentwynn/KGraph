import type { IntegrationAdapter } from '../integration-registry.js';
import { bulletWorkflow } from '../workflow-steps.js';

export const geminiAdapter: IntegrationAdapter = {
  name: 'gemini',
  label: 'Gemini CLI',
  targetPath: 'GEMINI.md',
  instructions: `## KGraph Workflow

${bulletWorkflow('gemini')}
`,
};
