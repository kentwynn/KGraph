import { describe, expect, it } from "vitest";
import { extractTsSymbols } from "../../src/scanner/ts-symbol-extractor.js";

describe("ts symbol extractor", () => {
  it("extracts imports, functions, classes, and methods", () => {
    const result = extractTsSymbols(
      `
import { b } from "./b";
export interface User { id: string; }
export type Session = { user: User };
export function a(): Session { return b(); }
export class C { run() { return true; } }
`,
      "src/a.ts"
    );

    expect(result.dependencies).toEqual(
      expect.arrayContaining([expect.objectContaining({ specifier: "./b", kind: "local" })])
    );
    expect(result.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "a", kind: "function", exported: true }),
        expect.objectContaining({ name: "User", kind: "interface", exported: true }),
        expect.objectContaining({ name: "Session", kind: "type", exported: true }),
        expect.objectContaining({ name: "C", kind: "class", exported: true }),
        expect.objectContaining({ name: "run", kind: "method", parentName: "C" })
      ])
    );
  });

  it("extracts class ownership and direct function calls", () => {
    const result = extractTsSymbols(
      `
function parseToken() { return true; }
export function refreshSession() { return parseToken(); }
export class AuthService {
  refresh() {
    return refreshSession();
  }
}
`,
      "src/auth.ts"
    );

    const cls = result.symbols.find((symbol) => symbol.name === "AuthService");
    const method = result.symbols.find((symbol) => symbol.name === "refresh");
    const refreshSession = result.symbols.find((symbol) => symbol.name === "refreshSession");
    const parseToken = result.symbols.find((symbol) => symbol.name === "parseToken");

    expect(result.relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: cls?.id,
          targetId: method?.id,
          relationshipType: "symbol-contains",
          confidence: "high",
        }),
        expect.objectContaining({
          sourceId: refreshSession?.id,
          targetId: parseToken?.id,
          relationshipType: "calls",
          confidence: "high",
        }),
        expect.objectContaining({
          sourceId: method?.id,
          targetId: refreshSession?.id,
          relationshipType: "calls",
          confidence: "high",
        }),
      ])
    );
  });

  it("tracks imported and unresolved property calls without failing", () => {
    const result = extractTsSymbols(
      `
import { loadUser } from "./users";

export function run(auth: { refresh(): void }) {
  loadUser();
  auth.refresh();
}
`,
      "src/session.ts"
    );

    const run = result.symbols.find((symbol) => symbol.name === "run");

    expect(result.relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: run?.id,
          targetId: "src/users.ts#loadUser",
          relationshipType: "calls",
          confidence: "medium",
        }),
        expect.objectContaining({
          sourceId: run?.id,
          targetId: "auth.refresh",
          relationshipType: "calls",
          confidence: "low",
        }),
      ])
    );
    expect(result.warnings).toHaveLength(0);
  });
});
