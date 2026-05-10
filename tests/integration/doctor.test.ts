import { describe, expect, it } from 'vitest';
import { cleanupTempRepo, copyFixture, runCli } from '../fixtures/helpers.js';

describe('kgraph doctor', () => {
  it('reports missing initialization and healthy scanned workspace', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      const beforeInit = await runCli(repo, ['doctor']);
      expect(beforeInit.code).toBe(1);
      expect(beforeInit.stdout).toContain('FAIL  workspace');

      await runCli(repo, ['init']);
      await runCli(repo, ['scan']);
      const afterScan = await runCli(repo, ['doctor']);
      expect(afterScan.code).toBe(0);
      expect(afterScan.stdout).toContain('OK  workspace');
      expect(afterScan.stdout).toContain('OK  maps');
      expect(afterScan.stdout).toContain('scan result');

      const quality = await runCli(repo, ['doctor', '--quality']);
      expect(quality.code).toBe(0);
      expect(quality.stdout).toContain('KGraph Cognition Quality');
      expect(quality.stdout).toContain('Notes:');
      expect(quality.stdout).toContain('Unresolved local imports:');
      expect(quality.stdout).toContain('Unresolved call edges:');
      expect(quality.stdout).toContain('Duplicate cognition titles:');
      expect(quality.stdout).toContain('Generated files scanned:');
      expect(quality.stdout).toContain('Expensive files:');
      expect(quality.stdout).toContain('Session repeated reads:');
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});
