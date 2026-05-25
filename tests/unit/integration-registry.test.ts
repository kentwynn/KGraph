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
        '.agents/skills/kgraph/SKILL.md',
        '.agents/skills/kgraph-doctor/SKILL.md',
        '.agents/skills/kgraph-impact/SKILL.md',
        '.agents/skills/kgraph-session/SKILL.md',
        '.agents/skills/kgraph-repair/SKILL.md',
        '.agents/skills/kgraph-compact/SKILL.md',
        '.agents/skills/kgraph-pack/SKILL.md',
        '.agents/skills/kgraph-knowledge/SKILL.md',
        '.agents/skills/kgraph-stale/SKILL.md',
        '.agents/skills/kgraph-blame/SKILL.md',
        '.agents/skills/kgraph-conclude/SKILL.md',
        '.agents/skills/kgraph-scan/SKILL.md',
      ]),
    );
    expect(
      getIntegrationAdapter('codex').commandFiles?.map((file) => file.path),
    ).toEqual(
      expect.arrayContaining([
        '.agents/skills/kgraph/SKILL.md',
        '.agents/skills/kgraph-doctor/SKILL.md',
        '.agents/skills/kgraph-impact/SKILL.md',
        '.agents/skills/kgraph-session/SKILL.md',
        '.agents/skills/kgraph-repair/SKILL.md',
        '.agents/skills/kgraph-compact/SKILL.md',
        '.agents/skills/kgraph-pack/SKILL.md',
        '.agents/skills/kgraph-knowledge/SKILL.md',
        '.agents/skills/kgraph-stale/SKILL.md',
        '.agents/skills/kgraph-blame/SKILL.md',
        '.agents/skills/kgraph-conclude/SKILL.md',
        '.agents/skills/kgraph-scan/SKILL.md',
      ]),
    );
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
        applyContextPolicy(adapter.instructions, 'smart', adapter.name),
        ...(adapter.commandFiles ?? []).map((file) =>
          applyContextPolicy(file.content, 'smart', adapter.name),
        ),
      ].join('\n');
      expect(content).toContain('kgraph pack "<topic>" --budget 8000 --json');
      expect(content).toContain(`--agent ${adapter.name}`);
      expect(content).toContain('kgraph doctor');
      expect(content).toContain('kgraph pack');
      expect(content).toContain('kgraph knowledge list');
      expect(content).toContain('Command routing comes first');
      expect(content).toContain('kgraph history "<topic>"');
      expect(content).toContain('kgraph update');
      expect(content).toContain('pending inbox');
      expect(content).toContain('kgraph stale');
      expect(content).toContain('kgraph blame');
      expect(content).toContain('kgraph session');
      expect(content).toContain('kgraph repair --dry-run');
      expect(content).toContain('kgraph compact --dry-run');
      expect(content).toContain('kgraph conclude');
      expect(content).toContain(
        'Use the returned KGraph ContextPack items as the first-pass source of truth',
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
      expect(content).toContain('--final');
      expect(content).toContain('--capture-file');
    }
  });

  it('generates a Copilot custom agent with the full numbered workflow', () => {
    const paths = getIntegrationAdapter('copilot').commandFiles?.map(
      (file) => file.path,
    );
    expect(paths).toContain('.github/agents/kgraph.agent.md');
    const agent = getIntegrationAdapter('copilot').commandFiles?.find(
      (file) => file.path === '.github/agents/kgraph.agent.md',
    );
    expect(agent?.content).toContain('--agent copilot');
    expect(agent?.content).toContain('{{KGRAPH_CONTEXT_POLICY}}');
    expect(agent?.content).toContain('{{KGRAPH_CAPTURE_POLICY}}');
    expect(agent?.content).toContain('kgraph doctor');
    expect(agent?.content).toContain('kgraph pack');
    expect(agent?.content).toContain('kgraph history');
    expect(agent?.content).toMatch(/[Vv]erify the change actually landed/);
    expect(agent?.content).toContain('--final');
  });

  it('generates the Claude kgraph command with the full numbered workflow', () => {
    const command = getIntegrationAdapter('claude-code').commandFiles?.find(
      (file) => file.path === '.claude/commands/kgraph.md',
    );
    expect(command?.content).toContain('--agent claude-code');
    expect(command?.content).toContain('{{KGRAPH_CONTEXT_POLICY}}');
    expect(command?.content).toContain('{{KGRAPH_CAPTURE_POLICY}}');
    expect(command?.content).toContain('kgraph doctor');
    expect(command?.content).toContain('kgraph pack');
    expect(command?.content).toContain('kgraph history');
    expect(command?.content).toMatch(/[Vv]erify the change actually landed/);
    expect(command?.content).toContain('--final');
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
