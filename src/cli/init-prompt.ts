import * as clack from '@clack/prompts';
import { listIntegrationAdapters } from '../integrations/integration-registry.js';
import type { IntegrationConfig, IntegrationName } from '../types/config.js';
import type { InitIntegrationRecommendation } from './init-recommendations.js';

// --- Integration prompt ---

export function shouldPromptForInitIntegrations(options: {
  explicitIntegrationsRequested: boolean;
  configuredIntegrations: Pick<IntegrationConfig, 'name'>[];
  interactive?: boolean;
}): boolean {
  const interactive = options.interactive ?? isInteractiveTerminal();
  return (
    interactive &&
    !options.explicitIntegrationsRequested &&
    options.configuredIntegrations.length === 0
  );
}

export async function promptForInitIntegrations(
  recommendations: InitIntegrationRecommendation[],
): Promise<IntegrationName[]> {
  const recNames = recommendations.map((item) => item.name);

  const action = await clack.select({
    message: 'AI tool integrations',
    options: [
      ...(recommendations.length > 0
        ? [
            {
              value: 'recommended' as const,
              label: `Use recommended (${recNames.join(', ')})`,
              hint: recommendations
                .map((item) => `${item.name} — ${item.reason}`)
                .join('; '),
            },
          ]
        : []),
      { value: 'custom' as const, label: 'Custom selection' },
      { value: 'skip' as const, label: 'Skip' },
    ],
  });

  if (clack.isCancel(action) || action === 'skip') {
    return [];
  }

  if (action === 'recommended') {
    return recNames;
  }

  const recommendedNames = new Set(recNames);
  const otherAdapters = listIntegrationAdapters().filter(
    (adapter) => !recommendedNames.has(adapter.name),
  );

  const allOptions = [
    ...recommendations.map((rec) => ({
      value: rec.name,
      label: rec.name,
      hint: rec.reason,
    })),
    ...otherAdapters.map((adapter) => ({
      value: adapter.name,
      label: adapter.name,
    })),
  ];

  const selected = await clack.multiselect({
    message: 'Select integrations (space to toggle, enter to confirm)',
    options: allOptions,
    required: false,
  });

  if (clack.isCancel(selected)) {
    return [];
  }

  return selected as IntegrationName[];
}

function isInteractiveTerminal(): boolean {
  return Boolean(process.stdin.isTTY) && Boolean(process.stdout.isTTY);
}
