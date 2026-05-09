import { rename, rm } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cleanupTempRepo, copyFixture, readJson, runCli } from "../fixtures/helpers.js";
import type { FileMap, RelationshipMap } from "../../src/types/maps.js";

describe("kgraph remapping", () => {
  it("updates active maps and records moved files", async () => {
    const repo = await copyFixture("js-ts-repo");
    try {
      await runCli(repo, ["init"]);
      await runCli(repo, ["scan"]);
      await rename(path.join(repo, "src/session.ts"), path.join(repo, "src/session-store.ts"));
      await rm(path.join(repo, "README.md"));
      await runCli(repo, ["scan"]);
      const files = await readJson<FileMap>(repo, ".kgraph/map/files.json");
      const relationships = await readJson<RelationshipMap>(repo, ".kgraph/map/relationships.json");
      expect(files.files.map((file) => file.path)).not.toContain("README.md");
      expect(relationships.relationships).toEqual(
        expect.arrayContaining([expect.objectContaining({ relationshipType: "moved-from" })])
      );
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});
