import { describe, expect, it } from "vitest";
import { rankByFields } from "../../src/context/ranking.js";

describe("ranking", () => {
  it("scores exact field matches", () => {
    const ranked = rankByFields("auth token", [{ path: "src/auth.ts" }, { path: "src/session.ts" }], [
      { name: "path", value: (item) => item.path }
    ]);
    expect(ranked[0].item.path).toBe("src/auth.ts");
    expect(ranked[0].score).toBeGreaterThan(0);
  });
});
