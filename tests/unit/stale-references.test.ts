import { describe, expect, it } from "vitest";
import { evaluateReferenceStatus } from "../../src/cognition/cognition-updater.js";

describe("stale references", () => {
  it("marks absent references as stale", () => {
    expect(
      evaluateReferenceStatus(["src/old.ts"], ["oldFunction"], {
        files: [{ path: "src/new.ts" } as never],
        symbols: [{ name: "newFunction" } as never]
      })
    ).toBe("stale");
  });
});
