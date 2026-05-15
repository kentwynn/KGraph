import { describe, expect, it } from 'vitest';
import { renderRootHelp, renderWorkflowBanner } from '../../src/cli/help.js';
import { shouldRenderRootHelpBeforeParse } from '../../src/cli/index.js';

describe('root help', () => {
  it('renders branded command guidance without color', () => {
    const help = renderRootHelp(false);
    expect(help).toContain('KGraph · Atom Core');
    expect(help).toContain('persistent repo intelligence');
    expect(help).toContain('durable engineering memory');
    expect(help).toContain('init --integrations codex,gemini');
    expect(help).toContain('context "auth token refresh"');
    expect(help).toContain('session read src/auth.ts --agent codex');
    expect(help).toContain('integrate add gemini windsurf cline');
    expect(help).toContain('integrate add copilot --mode smart');
    expect(help).toContain('integrate set copilot --mode manual');
    expect(help).toContain('uninstall --yes');
    expect(help).toContain('--mode smart|always|manual|off');
    expect(help).toContain('Powered by Kent Wynn: https://kentwynn.com');
  });

  it('shows configured integration modes in the refresh banner', () => {
    const banner = renderWorkflowBanner(
      {
        files: 14,
        symbols: 29,
        cognitionNotes: 0,
        integrations: [
          { name: 'codex', mode: 'smart', enabled: true },
          { name: 'copilot', mode: 'always', enabled: true },
          { name: 'cursor', mode: 'off', enabled: false },
        ],
        memory: {
          atomsProcessed: 1,
          pendingInbox: 0,
          activeAtoms: 7,
          needsReviewAtoms: 2,
          staleAtoms: 1,
          highConfidenceMissingEvidence: 0,
        },
      },
      false,
    );

    expect(banner).toContain('integration modes');
    expect(banner).toContain('codex:smart, copilot:always, cursor:off');
    expect(banner).toContain('Memory');
    expect(banner).toContain('atoms processed');
    expect(banner).toContain('active atoms');
  });

  it('lets subcommands own their help output', () => {
    expect(shouldRenderRootHelpBeforeParse(['node', 'kgraph', '--help'])).toBe(
      true,
    );
    expect(
      shouldRenderRootHelpBeforeParse(['node', 'kgraph', 'session', '--help']),
    ).toBe(false);
    expect(
      shouldRenderRootHelpBeforeParse(['node', 'kgraph', 'integrate', '-h']),
    ).toBe(false);
  });
});
