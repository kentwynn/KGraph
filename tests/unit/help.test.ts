import { describe, expect, it } from "vitest";
import { renderRootHelp } from "../../src/cli/help.js";

describe("root help", () => {
  it("renders branded command guidance without color", () => {
    const help = renderRootHelp(false);
    expect(help).toContain("██╗");
    expect(help).toContain("KGraph Persistent repo intelligence");
    expect(help).toContain("init --integrations codex,gemini");
    expect(help).toContain("context \"auth token refresh\"");
    expect(help).toContain("integrate add gemini windsurf cline");
  });
});
