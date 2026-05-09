import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../../src/config/config.js";
import { scanRepository } from "../../src/scanner/repo-scanner.js";
import { cleanupTempRepo, copyFixture } from "../fixtures/helpers.js";

describe("repo scanner", () => {
  it("scans JS/TS files and generic metadata", async () => {
    const repo = await copyFixture("js-ts-repo");
    try {
      const result = await scanRepository(repo, DEFAULT_CONFIG);
      expect(result.files.map((file) => file.path)).toContain("src/auth.ts");
      expect(result.files.map((file) => file.path)).toContain("README.md");
      expect(result.symbols.map((symbol) => symbol.name)).toEqual(expect.arrayContaining(["loginUser", "AuthService"]));
      expect(result.dependencies).toEqual(expect.arrayContaining([expect.objectContaining({ fromFile: "src/auth.ts" })]));
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});
