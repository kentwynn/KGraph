import { describe, expect, it } from 'vitest';
import {
  getIntegrationAdapter,
  listIntegrationAdapters,
  normalizeIntegrationNames,
} from '../../src/integrations/integration-registry.js';

describe('integration registry', () => {
  it('lists supported AI tool integrations', () => {
    expect(listIntegrationAdapters().map((adapter) => adapter.name)).toEqual([
      'claude-code',
      'codex',
      'copilot',
      'cursor',
    ]);
  });

  it('defines command files for integrations that support reusable commands', () => {
    expect(
      getIntegrationAdapter('copilot').commandFiles?.map((file) => file.path),
    ).toContain('.github/prompts/kgraph-scan.prompt.md');
    expect(
      getIntegrationAdapter('codex').commandFiles?.map((file) => file.path),
    ).toContain('.agents/skills/kgraph/SKILL.md');
    expect(
      getIntegrationAdapter('claude-code').commandFiles?.map(
        (file) => file.path,
      ),
    ).toContain('.claude/commands/kgraph.md');
  });

  it('normalizes repeated comma and flag input', () => {
    expect(
      normalizeIntegrationNames(['codex,cursor', 'copilot', 'codex']),
    ).toEqual(['codex', 'cursor', 'copilot']);
  });

  it('rejects unsupported integrations', () => {
    expect(() => getIntegrationAdapter('unknown')).toThrow(
      'Unsupported integration',
    );
  });
});
