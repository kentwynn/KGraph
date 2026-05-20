import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cleanupTempRepo, copyFixture, readJson, runCli } from "../fixtures/helpers.js";
import type { FileMap, RelationshipMap, SymbolMap } from "../../src/types/maps.js";

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

  it("does not create moved-from relationships from newly excluded previous files", async () => {
    const repo = await copyFixture("js-ts-repo");
    try {
      await mkdir(path.join(repo, "api", "venv", "lib"), { recursive: true });
      await mkdir(path.join(repo, "api", "services", "openquery"), { recursive: true });
      const content = "export const reusedContent = true;\n";
      await writeFile(path.join(repo, "api", "venv", "lib", "old.ts"), content, "utf8");
      await writeFile(path.join(repo, "api", "services", "openquery", "new.ts"), content, "utf8");

      expect((await runCli(repo, ["init"])).code).toBe(0);
      const configPath = path.join(repo, ".kgraph", "config.yaml");
      await writeFile(
        configPath,
        "include:\n  - \"**/*\"\nexclude:\n  - .git\nlanguages:\n  precise:\n    - .ts\nmaxContextItems: 8\n",
        "utf8",
      );
      expect((await runCli(repo, ["scan"])).code).toBe(0);

      await writeFile(
        configPath,
        "include:\n  - \"**/*\"\nexclude:\n  - .git\n  - venv\nlanguages:\n  precise:\n    - .ts\nmaxContextItems: 8\n",
        "utf8",
      );
      expect((await runCli(repo, ["scan"])).code).toBe(0);

      const relationships = await readJson<RelationshipMap>(
        repo,
        ".kgraph/map/relationships.json",
      );
      expect(
        relationships.relationships.some((relationship) =>
          relationship.targetId.includes("api/venv"),
        ),
      ).toBe(false);
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});
