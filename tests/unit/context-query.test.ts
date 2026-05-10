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

  it("returns nearby ownership and call relationships for matched symbols", async () => {
    const repo = await createTempRepo();
    try {
      const workspace = await ensureWorkspace(repo);
      const classId = "src/auth.ts#class#AuthService#1#5";
      const methodId = "src/auth.ts#method#AuthService#refresh#2#4";
      const helperId = "src/auth.ts#function#refreshSession#7#9";
      const result = await queryContext(
        workspace,
        DEFAULT_CONFIG,
        {
          fileMap: { generatedAt: "", files: [{ path: "src/auth.ts", language: "typescript" } as never] },
          symbolMap: {
            generatedAt: "",
            symbols: [
              { id: classId, name: "AuthService", filePath: "src/auth.ts", kind: "class" } as never,
              { id: methodId, name: "refresh", filePath: "src/auth.ts", kind: "method", parentName: "AuthService" } as never,
              { id: helperId, name: "refreshSession", filePath: "src/auth.ts", kind: "function" } as never,
            ],
          },
          dependencyMap: { generatedAt: "", dependencies: [] },
          relationshipMap: {
            generatedAt: "",
            relationships: [
              {
                sourceType: "symbol",
                sourceId: classId,
                targetType: "symbol",
                targetId: methodId,
                relationshipType: "symbol-contains",
                confidence: "high",
              },
              {
                sourceType: "symbol",
                sourceId: methodId,
                targetType: "symbol",
                targetId: helperId,
                relationshipType: "calls",
                confidence: "high",
              },
            ],
          },
        },
        "AuthService"
      );

      expect(result.relationships).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ relationshipType: "symbol-contains" }),
          expect.objectContaining({ relationshipType: "calls" }),
        ])
      );
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});
