import { describe, expect, it } from "vitest";
import { parseMarkdownNote } from "../../src/cognition/markdown-note-parser.js";

describe("markdown note parser", () => {
  it("extracts frontmatter, sections, file refs, and symbol refs", () => {
    const note = parseMarkdownNote(`---
domain: auth
tags: [jwt]
---
# Auth Notes

## Summary

See src/auth.ts and refreshSession.
`);
    expect(note.title).toBe("Auth Notes");
    expect(note.domain).toBe("auth");
    expect(note.tags).toEqual(["jwt"]);
    expect(note.relatedFiles).toContain("src/auth.ts");
    expect(note.relatedSymbols).toContain("refreshSession");
  });
});
