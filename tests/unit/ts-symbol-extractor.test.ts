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
});
