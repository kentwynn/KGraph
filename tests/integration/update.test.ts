import { cp, access } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cleanupTempRepo, copyFixture, runCli } from "../fixtures/helpers.js";

describe("kgraph update", () => {
  it("processes inbox notes", async () => {
    const repo = await copyFixture("js-ts-repo");
    try {
      await runCli(repo, ["init"]);
      await runCli(repo, ["scan"]);
      await cp(
        path.join(process.cwd(), "tests/fixtures/cognition-notes/auth-debugging.md"),
        path.join(repo, ".kgraph/inbox/auth-debugging.md")
      );
      expect((await runCli(repo, ["update"])).code).toBe(0);
      await access(path.join(repo, ".kgraph/interactions/processed"));
      await access(path.join(repo, ".kgraph/domains/auth.md"));
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});
