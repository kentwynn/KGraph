import { describe, expect, it } from "vitest";
import { applyContextPolicy, removeManagedBlock, upsertManagedBlock } from "../../src/integrations/instruction-blocks.js";

describe("instruction blocks", () => {
  it("adds and replaces a KGraph-managed block while preserving user content", () => {
    const first = upsertManagedBlock("Keep this", "codex", "Use KGraph.");
    expect(first).toContain("Keep this");
    expect(first).toContain("BEGIN KGRAPH codex");

    const second = upsertManagedBlock(first, "codex", "Use KGraph again.");
    expect(second).toContain("Keep this");
    expect(second).toContain("Use KGraph again.");
    expect(second).not.toContain("Use KGraph.\nUse KGraph.");
  });

  it("removes only the KGraph-managed block", () => {
    const content = upsertManagedBlock("User instructions", "cursor", "KGraph guidance");
    expect(removeManagedBlock(content, "cursor")).toBe("User instructions\n");
  });

  it("renders context policy by integration mode", () => {
    expect(applyContextPolicy("Mode: {{KGRAPH_CONTEXT_POLICY}}", "smart")).toContain("For repo-specific coding");
    expect(applyContextPolicy("Mode: {{KGRAPH_CONTEXT_POLICY}}", "always")).toContain("Every chat in this repository");
    expect(applyContextPolicy("Mode: {{KGRAPH_CONTEXT_POLICY}}", "manual")).toContain("Do not run KGraph automatically");
  });
});
