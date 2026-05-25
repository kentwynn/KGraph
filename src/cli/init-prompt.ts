import * as clack from '@clack/prompts';
import { listIntegrationAdapters } from '../integrations/integration-registry.js';
import type {
  DomainHint,
  IntegrationConfig,
  IntegrationName,
} from '../types/config.js';
import type { InitIntegrationRecommendation } from './init-recommendations.js';
import type { WorkspaceInfo } from './workspace-detection.js';

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

// --- Scope confirmation prompt ---

export interface ScopeConfirmResult {
  proceed: boolean;
  narrowedInclude?: string[];
}

/**
 * If file count exceeds threshold, ask user whether to proceed or narrow scope.
 * For small repos, returns { proceed: true } without prompting.
 */
export async function promptScopeConfirmation(
  fileCount: number,
  threshold = 500,
): Promise<ScopeConfirmResult> {
  if (fileCount <= threshold || !isInteractiveTerminal()) {
    return { proceed: true };
  }

  const action = await clack.select({
    message: `Found ${fileCount.toLocaleString()} files in scope`,
    options: [
      { value: 'proceed', label: 'Continue with all files' },
      {
        value: 'narrow',
        label: 'Narrow to src/ only',
        hint: 'include: ["src/**"]',
      },
      { value: 'cancel', label: "Cancel — I'll edit config.yaml manually" },
    ],
  });

  if (clack.isCancel(action) || action === 'cancel') {
    return { proceed: false };
  }

  if (action === 'narrow') {
    return { proceed: true, narrowedInclude: ['src/**'] };
  }

  return { proceed: true };
}

// --- Workspace prompt ---

export interface WorkspacePromptResult {
  applyDomains: boolean;
  domainHints?: Record<string, DomainHint>;
}

/**
 * If a monorepo workspace is detected, offer to configure domain hints.
 * For simple projects (no workspace detected), skips silently.
 */
export async function promptWorkspaceSetup(
  info: WorkspaceInfo,
): Promise<WorkspacePromptResult> {
  if (!isInteractiveTerminal()) {
    return { applyDomains: false };
  }

  const packageNames = info.packages.map((p) => p.name).join(', ');
  const action = await clack.select({
    message: `Detected ${info.tool} workspace (${info.packages.length} packages: ${packageNames})`,
    options: [
      {
        value: 'apply',
        label: 'Configure domain hints from packages',
        hint: 'context packs will prefer the active package',
      },
      { value: 'skip', label: 'Skip — scan everything flat' },
    ],
  });

  if (clack.isCancel(action) || action === 'skip') {
    return { applyDomains: false };
  }

  const hints: Record<string, DomainHint> = {};
  for (const pkg of info.packages) {
    hints[pkg.name] = { paths: [pkg.path + '/**'] };
  }
  return { applyDomains: true, domainHints: hints };
}
