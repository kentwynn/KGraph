import { access, readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { describe, expect, it } from "vitest";
import { cleanupTempRepo, createTempRepo, runCli } from "../fixtures/helpers.js";

describe("kgraph init integrations", () => {
  it("creates workspace and selected integration instruction files", async () => {
    const repo = await createTempRepo();
    try {
      const result = await runCli(repo, ["init", "--integrations", "codex,cursor"]);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("Configured integrations: codex, cursor");

      await access(path.join(repo, "AGENTS.md"));
      await access(path.join(repo, ".cursor", "rules", "kgraph.mdc"));

      const config = YAML.parse(await readFile(path.join(repo, ".kgraph", "config.yaml"), "utf8"));
      expect(config.integrations.map((item: { name: string }) => item.name)).toEqual(["codex", "cursor"]);
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});
