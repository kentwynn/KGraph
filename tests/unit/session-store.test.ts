import { describe, expect, it } from 'vitest';
import { recordSessionEvent, buildSessionReport } from '../../src/session/session-store.js';
import { ensureWorkspace } from '../../src/storage/kgraph-paths.js';
import { cleanupTempRepo, createTempRepo, writeText } from '../fixtures/helpers.js';

describe('session store', () => {
  it('tracks per-agent repeated reads and token totals', async () => {
    const repo = await createTempRepo();
    try {
      const workspace = await ensureWorkspace(repo);
      await writeText(repo, 'src/auth.ts', 'export const token = true;\n');
      await recordSessionEvent(workspace, {
        agent: 'codex',
        type: 'start',
        captureSource: 'manual',
      });
      await recordSessionEvent(workspace, {
        agent: 'codex',
        type: 'read',
        path: 'src/auth.ts',
        captureSource: 'agent-reported',
      });
      await recordSessionEvent(workspace, {
        agent: 'codex',
        type: 'read',
        path: 'src/auth.ts',
        captureSource: 'agent-reported',
      });

      const report = await buildSessionReport(workspace);
      expect(report.activeAgents.map((agent) => agent.agent)).toContain('codex');
      expect(report.readCount).toBe(2);
      expect(report.repeatedReadCount).toBe(1);
      expect(report.estimatedReadTokens).toBeGreaterThan(0);
      expect(report.topRepeatedReads[0].path).toBe('src/auth.ts');
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});
