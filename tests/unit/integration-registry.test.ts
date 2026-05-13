import { describe, expect, it } from 'vitest';
import { applyContextPolicy } from '../../src/integrations/instruction-blocks.js';
import {
  getIntegrationAdapter,
  listIntegrationAdapters,
  normalizeIntegrationNames,
} from '../../src/integrations/integration-registry.js';

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
        '.github/prompts/kgraph-compact.prompt.md',
        '.github/prompts/kgraph-pack.prompt.md',
        '.github/prompts/kgraph-knowledge.prompt.md',
        '.github/prompts/kgraph-stale.prompt.md',
        '.github/prompts/kgraph-blame.prompt.md',
        '.github/prompts/kgraph-conclude.prompt.md',
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
        '.claude/commands/kgraph-compact.md',
        '.claude/commands/kgraph-pack.md',
        '.claude/commands/kgraph-knowledge.md',
        '.claude/commands/kgraph-stale.md',
        '.claude/commands/kgraph-blame.md',
        '.claude/commands/kgraph-conclude.md',
      ]),
    );
  });

  it('teaches integrations to prefer the one-command workflow and doctor', () => {
    for (const adapter of listIntegrationAdapters()) {
      const content = [
        applyContextPolicy(adapter.instructions, 'smart'),
        ...(adapter.commandFiles ?? []).map((file) =>
          applyContextPolicy(file.content, 'smart'),
        ),
      ].join('\n');
      expect(content).toContain('kgraph "<topic>"');
      expect(content).toContain('kgraph doctor');
      expect(content).toContain('kgraph pack');
      expect(content).toContain('kgraph knowledge list');
      expect(content).toContain('kgraph stale');
      expect(content).toContain('kgraph blame');
      expect(content).toContain('kgraph session');
      expect(content).toContain('kgraph repair --dry-run');
      expect(content).toContain('kgraph compact --dry-run');
      expect(content).toContain('kgraph conclude');
      expect(content).toContain(
        'Use the returned KGraph candidate files as the first-pass source of truth',
      );
      expect(content).toContain('do not run broad `find`');
      expect(content).toContain('do not retry malformed shell commands');
      expect(content).toContain('Do not rerun the same KGraph query');
      expect(content).toMatch(/[Vv]erify the change actually landed/);
      expect(content).toContain('git diff -- <path>');
      expect(content).toMatch(
        /At the end .*repository-file changes|At the end of any session that changed repository files/,
      );
      expect(content).toContain('store durable engineering memory');
      expect(content).toContain(
        'KGraph runtime capture, not project documentation',
      );
      expect(content).toContain('Do not skip capture for meaningful UI text');
      expect(content).toContain('If repo files changed');
    }
    expect(
      getIntegrationAdapter('copilot').commandFiles?.map((file) => file.path),
    ).not.toContain('.github/prompts/kgraph.prompt.md');
    expect(getIntegrationAdapter('copilot').obsoleteCommandFiles).toContain(
      '.github/prompts/kgraph.prompt.md',
    );
  });

  it('does not generate a Copilot custom agent', () => {
    expect(
      getIntegrationAdapter('copilot').commandFiles?.map((file) => file.path),
    ).not.toContain('.github/agents/kgraph.agent.md');
    expect(getIntegrationAdapter('copilot').obsoleteCommandFiles).not.toContain(
      '.github/agents/kgraph.agent.md',
    );
  });

  it('keeps the Claude generic kgraph command focused on the single normal entry point', () => {
    const command = getIntegrationAdapter('claude-code').commandFiles?.find(
      (file) => file.path === '.claude/commands/kgraph.md',
    );
    expect(command?.content).toContain(
      'single normal `kgraph "<topic>"` entry point',
    );
    expect(command?.content).toContain('Run exactly one command');
    expect(command?.content).toContain('`kgraph "<topic>"`');
    expect(command?.content).toContain('Verify the change actually landed');
    expect(command?.content).toContain('Do not run `kgraph` again');
    expect(command?.content).not.toContain('Run `kgraph pack');
    expect(command?.content).not.toContain('Run `kgraph doctor');
    expect(command?.content).not.toContain('{{KGRAPH_CONTEXT_POLICY}}');
  });

  it('adds Claude Code hook files for automatic session capture', () => {
    expect(
      getIntegrationAdapter('claude-code').commandFiles?.map(
        (file) => file.path,
      ),
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

  it('normalizes space-separated input from PowerShell', () => {
    expect(normalizeIntegrationNames(['codex gemini'])).toEqual([
      'codex',
      'gemini',
    ]);
  });

  it('rejects unsupported integrations', () => {
    expect(() => getIntegrationAdapter('unknown')).toThrow(
      'Supported integrations: claude-code, cline, codex, copilot, cursor, gemini, windsurf',
    );
  });
});
