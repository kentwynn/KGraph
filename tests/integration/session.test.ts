import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type {
  SessionLedgerEntry,
  SessionState,
} from '../../src/types/session.js';
import {
  cleanupTempRepo,
  copyFixture,
  readJson,
  runCli,
} from '../fixtures/helpers.js';

describe('kgraph session', () => {
  it('records start/read/write/end events with agent attribution', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      await runCli(repo, ['init']);
      await runCli(repo, ['scan']);

      expect(
        (await runCli(repo, ['session', 'start', '--agent', 'codex'])).code,
      ).toBe(0);
      expect(
        (
          await runCli(repo, [
            'session',
            'read',
            'src/auth.ts',
            '--agent',
            'codex',
          ])
        ).stdout,
      ).toContain('recorded read');
      expect(
        (
          await runCli(repo, [
            'session',
            'read',
            'src/auth.ts',
            '--agent',
            'codex',
          ])
        ).stdout,
      ).toContain('repeated');
      expect(
        (
          await runCli(repo, [
            'session',
            'write',
            'src/auth.ts',
            '--agent',
            'codex',
          ])
        ).stdout,
      ).toContain('recorded write');

      const status = await runCli(repo, ['session']);
      expect(status.stdout).toContain('KGraph Session');
      expect(status.stdout).toContain('Repeated reads: 1');
      expect(status.stdout).toContain('Next');
      expect(status.stdout).toContain('kgraph context "<topic>"');

      const json = await runCli(repo, ['session', '--json']);
      expect(JSON.parse(json.stdout).repeatedReadCount).toBe(1);

      expect(
        (await runCli(repo, ['session', 'end', '--agent', 'codex'])).code,
      ).toBe(0);
      const ledger = await readJson<SessionLedgerEntry[]>(
        repo,
        '.kgraph/sessions/ledger.json',
      );
      expect(ledger[0].agent).toBe('codex');
      expect(ledger[0].repeatedReadCount).toBe(1);

      expect((await runCli(repo, ['session', 'reset'])).code).toBe(0);
      const state = await readJson<SessionState>(
        repo,
        '.kgraph/sessions/current.json',
      ).catch(() => undefined);
      expect(state).toBeUndefined();
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('records automatic context events from pack and root workflows', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      await runCli(repo, ['init']);

      const pack = await runCli(repo, [
        'pack',
        'auth refresh',
        '--json',
        '--agent',
        'codex',
      ]);
      expect(pack.code).toBe(0);
      expect(JSON.parse(pack.stdout).task).toBe('auth refresh');

      let state = await readJson<SessionState>(
        repo,
        '.kgraph/sessions/current.json',
      );
      expect(state.active.codex?.agent).toBe('codex');
      expect(state.events).toMatchObject([
        {
          agent: 'codex',
          type: 'context',
          captureSource: 'automatic',
        },
      ]);
      expect(state.events[0].packUsedTokens).toBeGreaterThanOrEqual(0);
      expect(state.events[0].packOmittedTokens).toBeGreaterThanOrEqual(0);

      const root = await runCli(repo, ['auth refresh', '--agent', 'codex']);
      expect(root.code).toBe(0);
      expect(root.stdout).toContain('KGraph Context');

      state = await readJson<SessionState>(
        repo,
        '.kgraph/sessions/current.json',
      );
      expect(
        state.events.filter((event) => event.type === 'context'),
      ).toHaveLength(2);
      expect(state.events.some((event) => event.type === 'read')).toBe(false);

      const status = await runCli(repo, ['session']);
      expect(status.stdout).toContain('Active agents: codex');
      expect(status.stdout).toContain('Pack calls: 2');
      expect(status.stdout).toContain('codex context [automatic]');
      expect(status.stdout).toContain('used:');
      expect(status.stdout).toContain('filtered:');

      const sessionJson = JSON.parse(
        (await runCli(repo, ['session', '--json'])).stdout,
      );
      expect(sessionJson.packCallCount).toBe(2);
      expect(typeof sessionJson.totalPackUsedTokens).toBe('number');
      expect(typeof sessionJson.totalPackOmittedTokens).toBe('number');
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('stores durable cognition when ending with --conclude', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      await runCli(repo, ['init']);
      await runCli(repo, ['scan']);
      await runCli(repo, ['session', 'start', '--agent', 'codex']);
      await runCli(repo, [
        'session',
        'read',
        'src/auth.ts',
        '--agent',
        'codex',
      ]);
      await runCli(repo, [
        'session',
        'write',
        'src/session.ts',
        '--agent',
        'codex',
      ]);

      const result = await runCli(repo, [
        'session',
        'end',
        '--agent',
        'codex',
        '--conclude',
        '--topic',
        'auth session memory',
        '--type',
        'finding',
        '--confidence',
        'high',
      ]);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Stored session cognition');
      const context = await runCli(repo, ['context', 'auth session memory']);
      expect(context.stdout).toContain('auth session memory');
      expect(context.stdout).toContain('finding, high');
      expect(context.stdout).toContain('src/auth.ts');
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('concludes only the active session and does not write on invalid end', async () => {
    const repo = await copyFixture('js-ts-repo');
    try {
      await runCli(repo, ['init']);
      await runCli(repo, ['scan']);

      const invalid = await runCli(repo, [
        'session',
        'end',
        '--agent',
        'codex',
        '--conclude',
        '--topic',
        'invalid session conclusion',
      ]);
      expect(invalid.code).toBe(1);
      expect(invalid.stderr).toContain('No active session');
      expect(await cognitionTitles(repo)).not.toContain(
        'invalid session conclusion',
      );

      await runCli(repo, ['session', 'start', '--agent', 'codex']);
      await runCli(repo, [
        'session',
        'read',
        'src/auth.ts',
        '--agent',
        'codex',
      ]);
      await runCli(repo, ['session', 'end', '--agent', 'codex']);

      await runCli(repo, ['session', 'start', '--agent', 'codex']);
      await runCli(repo, [
        'session',
        'read',
        'src/session.ts',
        '--agent',
        'codex',
      ]);
      await runCli(repo, [
        'session',
        'end',
        '--agent',
        'codex',
        '--conclude',
        '--topic',
        'second session conclusion',
      ]);

      const note = await cognitionByTitle(repo, 'second session conclusion');
      expect(note?.relatedFiles).toEqual(['src/session.ts']);
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});

async function cognitionTitles(repo: string): Promise<string[]> {
  return (await cognitionNotes(repo)).map((note) => note.title);
}

async function cognitionByTitle(
  repo: string,
  title: string,
): Promise<{ title: string; relatedFiles: string[] } | undefined> {
  return (await cognitionNotes(repo)).find((note) => note.title === title);
}

async function cognitionNotes(
  repo: string,
): Promise<Array<{ title: string; relatedFiles: string[] }>> {
  const dir = path.join(repo, '.kgraph', 'cognition');
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const notes: Array<{ title: string; relatedFiles: string[] }> = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const raw = await readFile(path.join(dir, entry.name), 'utf8');
    const match = raw.match(/```json\n([\s\S]*?)\n```/);
    if (match) {
      notes.push(JSON.parse(match[1]));
    }
  }
  return notes;
}
