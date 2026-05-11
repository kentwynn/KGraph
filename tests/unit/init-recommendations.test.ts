import { describe, expect, it } from 'vitest';
import {
  detectMachineIntegrationRecommendations,
  integrationSetupCommand,
  recommendedIntegrationsForInit,
} from '../../src/cli/init-recommendations.js';

function normalizePathSeparators(value: string): string {
  return value.replace(/\\/g, '/');
}

describe('init recommendations', () => {
  it('detects likely machine integrations from VS Code extensions and PATH executables', async () => {
    const recommendations = await detectMachineIntegrationRecommendations({
      env: { PATH: '/tools/bin', PATHEXT: '.CMD;.EXE' },
      platform: 'win32',
      homeDir: '/home/test',
      exists: async (targetPath) =>
        normalizePathSeparators(targetPath) ===
          '/home/test/.vscode/extensions' ||
        normalizePathSeparators(targetPath) === '/tools/bin/codex.CMD',
      readDir: async () => ['github.copilot-1.0.0'],
    });

    expect(recommendations).toEqual([
      { name: 'codex', reason: 'codex executable detected on PATH' },
      { name: 'copilot', reason: 'VS Code Copilot detected' },
    ]);
  });

  it('detects bundled Copilot in VS Code install directory', async () => {
    const recommendations = await detectMachineIntegrationRecommendations({
      env: { PATH: '', LOCALAPPDATA: '/local' },
      platform: 'win32',
      homeDir: '/home/test',
      localAppData: '/local',
      exists: async (targetPath) => {
        const normalized = normalizePathSeparators(targetPath);
        return (
          normalized === '/local/Programs/Microsoft VS Code' ||
          normalized ===
            '/local/Programs/Microsoft VS Code/abc123/resources/app/extensions/copilot'
        );
      },
      readDir: async (targetPath) => {
        const normalized = normalizePathSeparators(targetPath);
        if (normalized === '/local/Programs/Microsoft VS Code') {
          return ['abc123'];
        }
        return [];
      },
    });

    expect(recommendations).toEqual([
      { name: 'copilot', reason: 'VS Code Copilot detected' },
    ]);
  });

  it('filters out already configured integrations', () => {
    expect(
      recommendedIntegrationsForInit({
        configuredIntegrations: [{ name: 'copilot' }],
        detectedIntegrations: [
          { name: 'copilot', reason: 'VS Code Copilot detected' },
          { name: 'codex', reason: 'codex executable detected on PATH' },
        ],
      }),
    ).toEqual([{ name: 'codex', reason: 'codex executable detected on PATH' }]);
  });

  it('builds init next-step commands from recommendations', () => {
    expect(
      integrationSetupCommand([
        { name: 'copilot', reason: 'VS Code Copilot detected' },
        { name: 'codex', reason: 'codex executable detected on PATH' },
      ]),
    ).toBe('kgraph integrate add copilot codex');
  });
});
