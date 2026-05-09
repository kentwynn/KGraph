import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cleanupTempRepo, createTempRepo, runCli } from "../fixtures/helpers.js";

describe("kgraph init", () => {
  it("creates workspace and preserves existing cognition", async () => {
    const repo = await createTempRepo();
    try {
      const first = await runCli(repo, ["init"]);
      expect(first.code).toBe(0);
      await access(path.join(repo, ".kgraph", "config.yaml"));
      await mkdir(path.join(repo, ".kgraph", "cognition"), { recursive: true });
      await writeFile(path.join(repo, ".kgraph", "cognition", "note.md"), "keep", "utf8");
      const second = await runCli(repo, ["init"]);
      expect(second.code).toBe(0);
      await access(path.join(repo, ".kgraph", "cognition", "note.md"));
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});
