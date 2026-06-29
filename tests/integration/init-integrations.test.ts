import { access, readFile, realpath } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import {
  cleanupTempRepo,
  createTempRepo,
  runCli,
} from '../fixtures/helpers.js';

describe('kgraph init integrations', () => {
  it('creates workspace and selected integration instruction files', async () => {
    const repo = await createTempRepo();
    try {
      const result = await runCli(repo, [
        'init',
        '--integrations',
        'codex,cursor',
      ]);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain(
        'Configured integrations: codex:always, cursor:always',
      );

      await access(path.join(repo, 'AGENTS.md'));
      await access(path.join(repo, '.agents', 'skills', 'kgraph', 'SKILL.md'));
      await access(
        path.join(repo, '.agents', 'skills', 'kgraph-update', 'SKILL.md'),
      );
      await access(
        path.join(repo, '.agents', 'skills', 'kgraph-scan', 'SKILL.md'),
      );
      await access(path.join(repo, '.cursor', 'rules', 'kgraph.mdc'));
      await expect(
        access(path.join(repo, '.cursor', 'rules', 'kgraph-commands.mdc')),
      ).rejects.toThrow();

      const config = YAML.parse(
        await readFile(path.join(repo, '.kgraph', 'config.yaml'), 'utf8'),
      );
      expect(
        config.integrations.map((item: { name: string }) => item.name),
      ).toEqual(['codex', 'cursor']);
      expect(
        config.integrations.map((item: { mode: string }) => item.mode),
      ).toEqual(['always', 'always']);
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('can configure VS Code MCP during init', async () => {
    const repo = await createTempRepo();
    try {
      const result = await runCli(repo, [
        'init',
        '--integrations',
        'copilot',
        '--mcp',
      ]);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Configured integrations: copilot:always');
      expect(result.stdout).toContain('Configured VS Code MCP server: KGraph');

      const mcp = JSON.parse(
        await readFile(vscodeMcpConfigPath(repo), 'utf8'),
      );
      expect(mcp.servers.KGraph).toEqual({
        command: 'kgraph',
        args: ['mcp', '--root', await realpath(repo)],
        type: 'stdio',
      });
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});

function vscodeMcpConfigPath(repo: string): string {
  return path.join(
    os.tmpdir(),
    'kgraph-vscode-mcp-test-' + path.basename(repo),
    'mcp.json',
  );
}
