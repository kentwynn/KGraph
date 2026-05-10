import { describe, expect, it } from 'vitest';
import { cleanupTempRepo, copyFixture, readJson, runCli } from '../fixtures/helpers.js';
import type { SessionLedgerEntry, SessionState } from '../../src/types/session.js';

describe('kgraph session', () => {
  it('records start/read/write/end events with agent attribution', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      await runCli(repo, ['init']);
      await runCli(repo, ['scan']);

      expect((await runCli(repo, ['session', 'start', '--agent', 'codex'])).code).toBe(0);
      expect((await runCli(repo, ['session', 'read', 'src/auth.ts', '--agent', 'codex'])).stdout).toContain('recorded read');
      expect((await runCli(repo, ['session', 'read', 'src/auth.ts', '--agent', 'codex'])).stdout).toContain('repeated');
      expect((await runCli(repo, ['session', 'write', 'src/auth.ts', '--agent', 'codex'])).stdout).toContain('recorded write');

      const status = await runCli(repo, ['session']);
      expect(status.stdout).toContain('KGraph Session');
      expect(status.stdout).toContain('Repeated reads: 1');

      const json = await runCli(repo, ['session', '--json']);
      expect(JSON.parse(json.stdout).repeatedReadCount).toBe(1);

      expect((await runCli(repo, ['session', 'end', '--agent', 'codex'])).code).toBe(0);
      const ledger = await readJson<SessionLedgerEntry[]>(repo, '.kgraph/sessions/ledger.json');
      expect(ledger[0].agent).toBe('codex');
      expect(ledger[0].repeatedReadCount).toBe(1);

      expect((await runCli(repo, ['session', 'reset'])).code).toBe(0);
      const state = await readJson<SessionState>(repo, '.kgraph/sessions/current.json').catch(() => undefined);
      expect(state).toBeUndefined();
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});
