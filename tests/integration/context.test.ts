import { cp } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cleanupTempRepo, copyFixture, runCli } from "../fixtures/helpers.js";

describe("kgraph context", () => {
  it("returns markdown and json context", async () => {
    const repo = await copyFixture("js-ts-repo");
    try {
      await runCli(repo, ["init"]);
      await runCli(repo, ["scan"]);
      await cp(
        path.join(process.cwd(), "tests/fixtures/cognition-notes/auth-debugging.md"),
        path.join(repo, ".kgraph/inbox/auth-debugging.md")
      );
      await runCli(repo, ["update"]);
      const markdown = await runCli(repo, ["context", "auth refresh"]);
      expect(markdown.stdout).toContain("# KGraph Context");
      const json = await runCli(repo, ["context", "auth refresh", "--json"]);
      expect(JSON.parse(json.stdout).query).toBe("auth refresh");
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it("returns impact for matched symbols", async () => {
    const repo = await copyFixture("js-ts-repo");
    try {
      await runCli(repo, ["init"]);
      await runCli(repo, ["scan"]);
      const result = await runCli(repo, ["impact", "refreshSession"]);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("# KGraph Impact");
      expect(result.stdout).toContain("refreshSession");
      expect(result.stdout).toContain("Called By");
      expect(result.stdout).toContain("loginUser");
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it("runs the default refresh workflow with a topic", async () => {
    const repo = await copyFixture("js-ts-repo");
    try {
      await runCli(repo, ["init"]);
      const result = await runCli(repo, ["auth refresh"]);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("Refresh Complete");
      expect(result.stdout).toContain("# KGraph Context");
      expect(result.stdout).toContain("src/auth.ts");
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it("runs the default refresh workflow without a topic and prints next actions", async () => {
    const repo = await copyFixture("js-ts-repo");
    try {
      await runCli(repo, ["init"]);
      const result = await runCli(repo, []);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("KGraph");
      expect(result.stdout).toContain("Refresh Complete");
      expect(result.stdout).toContain("files");
      expect(result.stdout).toContain("Next");
      expect(result.stdout).toContain('kgraph "auth token refresh"');
      expect(result.stdout).toContain("kgraph --help");
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it("prints root help for plain kgraph before initialization", async () => {
    const repo = await copyFixture("js-ts-repo");
    try {
      const result = await runCli(repo, []);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("KGraph");
      expect(result.stdout).toContain("Usage");
      expect(result.stdout).toContain("init");
      expect(result.stderr).toBe("");
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});
