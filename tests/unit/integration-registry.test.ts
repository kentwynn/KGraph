import { describe, expect, it } from 'vitest';
import {
  getIntegrationAdapter,
  listIntegrationAdapters,
  normalizeIntegrationNames,
} from '../../src/integrations/integration-registry.js';
import { applyContextPolicy } from '../../src/integrations/instruction-blocks.js';

describe('integration registry', () => {
  it('lists supported AI tool integrations', () => {
    expect(listIntegrationAdapters().map((adapter) => adapter.name)).toEqual([
      'claude-code',
      'cline',
      'codex',
      'copilot',
      'cursor',
      'gemini',
      'windsurf',
    ]);
  });

  it('defines native instruction targets for Gemini, Windsurf, and Cline', () => {
    expect(getIntegrationAdapter('gemini').targetPath).toBe('GEMINI.md');
    expect(getIntegrationAdapter('windsurf').targetPath).toBe(
      '.windsurf/rules/kgraph.md',
    );
    expect(getIntegrationAdapter('cline').targetPath).toBe(
      '.clinerules/kgraph.md',
    );
    expect(getIntegrationAdapter('gemini').commandFiles).toBeUndefined();
    expect(getIntegrationAdapter('windsurf').commandFiles).toBeUndefined();
    expect(getIntegrationAdapter('cline').commandFiles).toBeUndefined();
  });

  it('defines command files for integrations that support reusable commands', () => {
    expect(
      getIntegrationAdapter('copilot').commandFiles?.map((file) => file.path),
    ).toEqual(
      expect.arrayContaining([
        '.github/prompts/kgraph-doctor.prompt.md',
        '.github/prompts/kgraph-impact.prompt.md',
        '.github/prompts/kgraph-session.prompt.md',
        '.github/prompts/kgraph-repair.prompt.md',
        '.github/prompts/kgraph-scan.prompt.md',
      ]),
    );
    expect(
      getIntegrationAdapter('codex').commandFiles?.map((file) => file.path),
    ).toContain('.agents/skills/kgraph/SKILL.md');
    expect(
      getIntegrationAdapter('claude-code').commandFiles?.map(
        (file) => file.path,
      ),
    ).toEqual(
      expect.arrayContaining([
        '.claude/commands/kgraph.md',
        '.claude/commands/kgraph-doctor.md',
        '.claude/commands/kgraph-impact.md',
        '.claude/commands/kgraph-session.md',
        '.claude/commands/kgraph-repair.md',
      ]),
    );
  });

  it('teaches integrations to prefer the one-command workflow and doctor', () => {
    for (const adapter of listIntegrationAdapters()) {
      const content = [
        applyContextPolicy(adapter.instructions, 'smart'),
        ...(adapter.commandFiles ?? []).map((file) => applyContextPolicy(file.content, 'smart')),
      ].join('\n');
      expect(content).toContain('kgraph "<topic>"');
      expect(content).toContain('kgraph doctor');
      expect(content).toContain('kgraph session');
      expect(content).toContain('kgraph repair --dry-run');
      expect(content).toContain(
        'At the end of any session that changed repository files',
      );
      expect(content).toContain('write one concise Markdown note');
      expect(content).toContain('Do not skip capture for UI text');
      expect(content).toContain('If repo files changed');
    }
    expect(
      getIntegrationAdapter('copilot').commandFiles?.map((file) => file.path),
    ).not.toContain('.github/prompts/kgraph.prompt.md');
    expect(getIntegrationAdapter('copilot').obsoleteCommandFiles).toContain(
      '.github/prompts/kgraph.prompt.md',
    );
  });

  it('adds Claude Code hook files for automatic session capture', () => {
    expect(
      getIntegrationAdapter('claude-code').commandFiles?.map((file) => file.path),
    ).toEqual(
      expect.arrayContaining([
        '.claude/hooks/kgraph-session-start.cjs',
        '.claude/hooks/kgraph-session-pre-read.cjs',
        '.claude/hooks/kgraph-session-post-write.cjs',
        '.claude/hooks/kgraph-session-stop.cjs',
      ]),
    );
  });

  it('normalizes repeated comma and flag input', () => {
    expect(
      normalizeIntegrationNames([
        'codex,cursor',
        'gemini,windsurf',
        'cline',
        'codex',
      ]),
    ).toEqual(['codex', 'cursor', 'gemini', 'windsurf', 'cline']);
  });

  it('rejects unsupported integrations', () => {
    expect(() => getIntegrationAdapter('unknown')).toThrow(
      'Supported integrations: claude-code, cline, codex, copilot, cursor, gemini, windsurf',
    );
  });
});
