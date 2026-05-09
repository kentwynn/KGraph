import { describe, expect, it } from "vitest";
import { evaluateReferenceStatus } from "../../src/cognition/cognition-updater.js";

describe("cognition updater", () => {
  it("marks mixed reference status", () => {
    const status = evaluateReferenceStatus(["src/auth.ts", "src/missing.ts"], ["loginUser"], {
      files: [{ path: "src/auth.ts" } as never],
      symbols: [{ name: "loginUser" } as never]
    });
    expect(status).toBe("mixed");
  });
});
