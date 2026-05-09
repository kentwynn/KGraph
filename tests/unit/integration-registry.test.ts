import { describe, expect, it } from "vitest";
import { getIntegrationAdapter, listIntegrationAdapters, normalizeIntegrationNames } from "../../src/integrations/integration-registry.js";

describe("integration registry", () => {
  it("lists supported AI tool integrations", () => {
    expect(listIntegrationAdapters().map((adapter) => adapter.name)).toEqual([
      "claude-code",
      "codex",
      "copilot",
      "cursor"
    ]);
  });

  it("normalizes repeated comma and flag input", () => {
    expect(normalizeIntegrationNames(["codex,cursor", "copilot", "codex"])).toEqual([
      "codex",
      "cursor",
      "copilot"
    ]);
  });

  it("rejects unsupported integrations", () => {
    expect(() => getIntegrationAdapter("unknown")).toThrow("Unsupported integration");
  });
});
