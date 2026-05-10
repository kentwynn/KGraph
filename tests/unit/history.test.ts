import { describe, expect, it } from 'vitest';
import {
  parseTimestampFromFilename,
  renderHistory,
  type HistoryEntry,
} from '../../src/cli/commands/history.js';

describe('parseTimestampFromFilename', () => {
  it('parses a valid timestamped filename', () => {
    const d = parseTimestampFromFilename(
      '2026-05-09T09-36-06-247Z-auth-flow-findings.md',
    );
    expect(d).toBeInstanceOf(Date);
    expect(d?.toISOString()).toBe('2026-05-09T09:36:06.247Z');
  });

  it('returns undefined for a non-timestamped filename', () => {
    expect(parseTimestampFromFilename('my-note.md')).toBeUndefined();
  });

  it('returns undefined for a partially matching filename', () => {
    expect(parseTimestampFromFilename('2026-05-09-auth.md')).toBeUndefined();
  });

  it('parses midnight correctly', () => {
    const d = parseTimestampFromFilename(
      '2026-01-01T00-00-00-000Z-first-note.md',
    );
    expect(d?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('renderHistory', () => {
  it('shows empty message when no entries', () => {
    const output = renderHistory([], false);
    expect(output).toContain('No processed cognition notes found');
    expect(output).toContain('kgraph update');
  });

  it('shows entry count in header', () => {
    const entries: HistoryEntry[] = [
      {
        timestamp: new Date('2026-05-09T09:36:06.247Z'),
        filename: '2026-05-09T09-36-06-247Z-auth.md',
        title: 'Auth Findings',
        author: 'kent',
      },
    ];
    const output = renderHistory(entries, false);
    expect(output).toContain('KGraph History');
    expect(output).toContain('1 entry');
  });

  it("uses 'entries' plural for multiple items", () => {
    const entries: HistoryEntry[] = [
      {
        timestamp: new Date('2026-05-09T09:36:06.247Z'),
        filename: 'a.md',
        title: 'First',
      },
      {
        timestamp: new Date('2026-05-09T10:00:00.000Z'),
        filename: 'b.md',
        title: 'Second',
      },
    ];
    const output = renderHistory(entries, false);
    expect(output).toContain('2 entries');
  });

  it('shows author when present', () => {
    const entries: HistoryEntry[] = [
      {
        timestamp: new Date('2026-05-09T09:36:06.247Z'),
        filename: 'a.md',
        title: 'Auth Findings',
        author: 'kentwynn',
      },
    ];
    const output = renderHistory(entries, false);
    expect(output).toContain('by kentwynn');
  });

  it('shows (uncommitted) when author is absent', () => {
    const entries: HistoryEntry[] = [
      {
        timestamp: new Date('2026-05-09T09:36:06.247Z'),
        filename: 'a.md',
        title: 'Auth Findings',
      },
    ];
    const output = renderHistory(entries, false);
    expect(output).toContain('(uncommitted)');
  });

  it('renders the entry title and formatted date', () => {
    const entries: HistoryEntry[] = [
      {
        timestamp: new Date('2026-05-09T09:36:06.247Z'),
        filename: 'a.md',
        title: 'Authentication Flow',
      },
    ];
    const output = renderHistory(entries, false);
    expect(output).toContain('Authentication Flow');
    expect(output).toContain('May');
    expect(output).toContain('2026');
    expect(output).toContain('09:36');
  });

  it('renders searched history header and summary', () => {
    const entries: HistoryEntry[] = [
      {
        timestamp: new Date('2026-05-09T09:36:06.247Z'),
        filename: 'a.md',
        title: 'Blog Button Change',
        summary: 'Removed the read more button from blog.',
      },
    ];
    const output = renderHistory(entries, false, 'blog button');
    expect(output).toContain('matching "blog button"');
    expect(output).toContain('Removed the read more button');
  });
});
