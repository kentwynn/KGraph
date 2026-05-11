import { describe, expect, it } from 'vitest';
import { shouldPromptForInitIntegrations } from '../../src/cli/init-prompt.js';

describe('init integration prompt', () => {
  it('prompts for interactive init runs with no integrations configured', () => {
    expect(
      shouldPromptForInitIntegrations({
        explicitIntegrationsRequested: false,
        configuredIntegrations: [],
        interactive: true,
      }),
    ).toBe(true);

    expect(
      shouldPromptForInitIntegrations({
        explicitIntegrationsRequested: true,
        configuredIntegrations: [],
        interactive: true,
      }),
    ).toBe(false);

    expect(
      shouldPromptForInitIntegrations({
        explicitIntegrationsRequested: false,
        configuredIntegrations: [{ name: 'copilot' }],
        interactive: true,
      }),
    ).toBe(false);

    expect(
      shouldPromptForInitIntegrations({
        explicitIntegrationsRequested: false,
        configuredIntegrations: [],
        interactive: false,
      }),
    ).toBe(false);
  });
});
