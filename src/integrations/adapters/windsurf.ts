import type { IntegrationAdapter } from '../integration-registry.js';
import { bulletWorkflow } from '../workflow-steps.js';

export const windsurfAdapter: IntegrationAdapter = {
  name: 'windsurf',
  label: 'Windsurf',
  targetPath: '.windsurf/rules/kgraph.md',
  instructions: `# KGraph Workflow

${bulletWorkflow('windsurf')}
`,
};
