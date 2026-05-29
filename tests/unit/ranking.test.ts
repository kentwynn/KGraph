import { describe, expect, it } from 'vitest';
import { rankByFields, tokenize } from '../../src/context/ranking.js';

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

  // --- prefix stem expansion tests ---

  it('tokenize expands long word to 4-char stem and half-length stem', () => {
    const tokens = tokenize('authentication');
    expect(tokens).toContain('authentication'); // original preserved
    expect(tokens).toContain('auth'); // 4-char stem
    expect(tokens).toContain('authent'); // half-length stem (floor(14*0.5)=7)
  });

  it('tokenize does not expand short tokens below 8 chars', () => {
    const tokens = tokenize('auth');
    expect(tokens).toEqual(['auth']); // no expansion, just the token itself
  });

  it('matches "authentication" query against "auth.ts" file path', () => {
    const ranked = rankByFields(
      'authentication',
      [{ path: 'src/auth.ts' }, { path: 'src/user.ts' }],
      [{ name: 'path', value: (item) => item.path }],
    );
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0].item.path).toBe('src/auth.ts');
  });

  it('matches "authentication" query against AuthService camelCase symbol', () => {
    const ranked = rankByFields(
      'authentication',
      [{ name: 'AuthService' }, { name: 'UserController' }],
      [{ name: 'name', value: (item) => item.name }],
    );
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0].item.name).toBe('AuthService');
  });

  it('matches "configuration" query to "config.ts" via half-length stem', () => {
    // "configuration" (13) → half = floor(13*0.5)=6 → "config" ✓
    const ranked = rankByFields(
      'configuration',
      [{ path: 'src/config.ts' }, { path: 'src/user.ts' }],
      [{ name: 'path', value: (item) => item.path }],
    );
    expect(ranked[0].item.path).toBe('src/config.ts');
  });

  it('matches "initialization" query to "init" symbol via 4-char stem', () => {
    const ranked = rankByFields(
      'initialization',
      [{ name: 'initApp' }, { name: 'renderPage' }],
      [{ name: 'name', value: (item) => item.name }],
    );
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0].item.name).toBe('initApp');
  });

  it('ranks files and symbols from maps even when no knowledge atoms exist', () => {
    // Simulates pack behaviour when .kgraph has no atoms yet —
    // results come purely from file/symbol maps.
    const ranked = rankByFields(
      'authentication service',
      [
        { path: 'src/auth.ts', name: 'AuthService' },
        { path: 'src/user.ts', name: 'UserModel' },
      ],
      [
        { name: 'path', value: (item) => item.path },
        { name: 'name', value: (item) => item.name },
      ],
    );
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0].item.path).toBe('src/auth.ts');
  });

  it('does not over-match unrelated files with short 4-char stem', () => {
    // "auth" stem should not match "authorize" differently than direct queries
    const ranked = rankByFields(
      'authentication',
      [
        { path: 'src/auth.ts' },
        { path: 'src/database.ts' },
        { path: 'src/payment.ts' },
      ],
      [{ name: 'path', value: (item) => item.path }],
    );
    // Only auth.ts should match — database and payment have no auth prefix
    expect(ranked).toHaveLength(1);
    expect(ranked[0].item.path).toBe('src/auth.ts');
  });
});
