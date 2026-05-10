import { describe, expect, it } from 'vitest';
import { rankByFields } from '../../src/context/ranking.js';

describe('ranking', () => {
  it('scores exact field matches', () => {
    const ranked = rankByFields(
      'auth token',
      [{ path: 'src/auth.ts' }, { path: 'src/session.ts' }],
      [{ name: 'path', value: (item) => item.path }],
    );
    expect(ranked[0].item.path).toBe('src/auth.ts');
    expect(ranked[0].score).toBeGreaterThan(0);
  });

  it('scores whole-word path matches higher than substring matches', () => {
    // "session.ts" has "session" as a whole word; "sessionmanager.ts" has it as a substring
    const ranked = rankByFields(
      'session',
      [{ path: 'src/sessionmanager.ts' }, { path: 'src/session.ts' }],
      [{ name: 'path', value: (item) => item.path }],
    );
    expect(ranked[0].item.path).toBe('src/session.ts');
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it('returns no results when nothing matches', () => {
    const ranked = rankByFields(
      'xyzzy',
      [{ path: 'src/auth.ts' }],
      [{ name: 'path', value: (item) => item.path }],
    );
    expect(ranked).toHaveLength(0);
  });

  it('includes word-boundary reason in reasons array', () => {
    const ranked = rankByFields(
      'auth',
      [{ path: 'src/auth.ts' }],
      [{ name: 'path', value: (item) => item.path }],
    );
    expect(ranked[0].reasons.some((r) => r.includes('(exact)'))).toBe(true);
  });

  it('matches camel-case identifier words', () => {
    const ranked = rankByFields(
      'session refresh',
      [{ name: 'refreshSession' }, { name: 'renderDashboard' }],
      [{ name: 'name', value: (item) => item.name }],
    );
    expect(ranked[0].item.name).toBe('refreshSession');
  });
});
