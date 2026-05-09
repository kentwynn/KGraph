import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, normalizeConfig } from "../../src/config/config.js";

describe("config", () => {
  it("uses defaults for missing fields", () => {
    expect(normalizeConfig({})).toEqual(DEFAULT_CONFIG);
  });

  it("normalizes custom max context items", () => {
    expect(normalizeConfig({ maxContextItems: 3 }).maxContextItems).toBe(3);
  });
});
