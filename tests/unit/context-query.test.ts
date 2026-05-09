import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../../src/config/config.js";
import { queryContext } from "../../src/context/context-query.js";
import { cleanupTempRepo, createTempRepo } from "../fixtures/helpers.js";
import { ensureWorkspace } from "../../src/storage/kgraph-paths.js";

describe("context query", () => {
  it("returns ranked files and symbols", async () => {
    const repo = await createTempRepo();
    try {
      const workspace = await ensureWorkspace(repo);
      const result = await queryContext(
        workspace,
        DEFAULT_CONFIG,
        {
          fileMap: { generatedAt: "", files: [{ path: "src/auth.ts", language: "typescript" } as never] },
          symbolMap: { generatedAt: "", symbols: [{ name: "loginUser", filePath: "src/auth.ts" } as never] },
          dependencyMap: { generatedAt: "", dependencies: [] },
          relationshipMap: { generatedAt: "", relationships: [] }
        },
        "auth login"
      );
      expect(result.relevantFiles).toHaveLength(1);
      expect(result.relevantSymbols).toHaveLength(1);
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});
