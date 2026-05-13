import { describe, expect, it } from 'vitest';
import { parseMarkdownNote } from '../../src/cognition/markdown-note-parser.js';

describe('markdown note parser', () => {
  it('extracts frontmatter, sections, file refs, and symbol refs', () => {
    const note = parseMarkdownNote(`---
domain: auth
tags: [jwt]
---
# Auth Notes

## Summary

See src/auth.ts and refreshSession.
`);
    expect(note.title).toBe('Auth Notes');
    expect(note.kind).toBe('summary');
    expect(note.confidence).toBe('medium');
    expect(note.domain).toBe('auth');
    expect(note.tags).toEqual(['jwt']);
    expect(note.relatedFiles).toContain('src/auth.ts');
    // plain-text symbols are not extracted (prevents JWT, CSRF, TODO false positives)
    expect(note.relatedSymbols).not.toContain('refreshSession');
  });

  it('extracts symbols from Key Symbols section only', () => {
    const note = parseMarkdownNote(`# Auth Fix

## Summary

Fixed JWT handling, CSRF token, and TODO items. Uses Next.js API.

## Key Files
- \`src/auth.ts\` — session management

## Key Symbols
- \`refreshSession\` — refreshes the JWT
- \`createSession\` — creates a new session
`);
    // Only declared Key Symbols should appear
    expect(note.relatedSymbols).toContain('refreshSession');
    expect(note.relatedSymbols).toContain('createSession');
    // Domain vocabulary from prose must not appear
    expect(note.relatedSymbols).not.toContain('JWT');
    expect(note.relatedSymbols).not.toContain('CSRF');
    expect(note.relatedSymbols).not.toContain('TODO');
    expect(note.relatedSymbols).not.toContain('Next');
  });

  it('extracts typed cognition and confidence from frontmatter', () => {
    const note = parseMarkdownNote(`---
type: gotcha
confidence: high
domain: auth
---
# Refresh Cookie Gotcha

## Summary

The refresh path must rotate the cookie expiry.
`);
    expect(note.kind).toBe('gotcha');
    expect(note.confidence).toBe('high');
  });
});
