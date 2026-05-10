import { describe, expect, it } from "vitest";
import { evaluateReferenceStatus } from "../../src/cognition/cognition-updater.js";
import { readDomainRecords, writeDomainRecord } from "../../src/storage/cognition-store.js";
import { ensureWorkspace } from "../../src/storage/kgraph-paths.js";
import { cleanupTempRepo, createTempRepo } from "../fixtures/helpers.js";

describe("cognition updater", () => {
  it("marks mixed reference status", () => {
    const status = evaluateReferenceStatus(["src/auth.ts", "src/missing.ts"], ["loginUser"], {
      files: [{ path: "src/auth.ts" } as never],
      symbols: [{ name: "loginUser" } as never]
    });
    expect(status).toBe("mixed");
  });

  it("merges repeated domain records instead of overwriting prior notes", async () => {
    const repo = await createTempRepo();
    try {
      const workspace = await ensureWorkspace(repo);
      await writeDomainRecord(workspace, {
        name: "auth",
        pathHints: ["src/auth.ts"],
        tags: ["session"],
        files: ["src/auth.ts"],
        symbols: ["loginUser"],
        cognitionNotes: ["note-1"],
      });
      await writeDomainRecord(workspace, {
        name: "auth",
        pathHints: ["src/session.ts"],
        tags: ["refresh"],
        files: ["src/session.ts"],
        symbols: ["refreshSession"],
        cognitionNotes: ["note-2"],
      });

      const [domain] = await readDomainRecords(workspace);
      expect(domain.files).toEqual(["src/auth.ts", "src/session.ts"]);
      expect(domain.symbols).toEqual(["loginUser", "refreshSession"]);
      expect(domain.cognitionNotes).toEqual(["note-1", "note-2"]);
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});
