import { describe, expect, it } from "vitest";
import { cleanupTempRepo, copyFixture, readJson, runCli } from "../fixtures/helpers.js";
import type { FileMap, SymbolMap } from "../../src/types/maps.js";

describe("kgraph scan", () => {
  it("writes structural maps", async () => {
    const repo = await copyFixture("js-ts-repo");
    try {
      expect((await runCli(repo, ["init"])).code).toBe(0);
      expect((await runCli(repo, ["scan"])).code).toBe(0);
      const files = await readJson<FileMap>(repo, ".kgraph/map/files.json");
      const symbols = await readJson<SymbolMap>(repo, ".kgraph/map/symbols.json");
      expect(files.files.map((file) => file.path)).toContain("src/auth.ts");
      expect(files.files.find((file) => file.path === "src/auth.ts")?.tokenEstimate).toBeGreaterThan(0);
      expect(symbols.symbols.map((symbol) => symbol.name)).toContain("loginUser");
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});
