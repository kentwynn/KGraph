import type { IntegrationAdapter } from "../integration-registry.js";

export const copilotAdapter: IntegrationAdapter = {
  name: "copilot",
  label: "GitHub Copilot",
  targetPath: ".github/copilot-instructions.md",
  instructions: `## KGraph Workflow

- Use \`kgraph context "<topic>"\` before scanning many files manually.
- Preserve stable findings by creating Markdown notes in \`.kgraph/inbox/\`.
- Use \`kgraph update\` to process chat summaries and debugging conclusions into durable cognition.
- Use \`kgraph scan\` when code structure changes.
- Use \`kgraph visualize\` when visualization support is available and the developer asks to inspect the repository knowledge map.
`,
  commandFiles: [
    {
      path: ".github/prompts/kgraph.prompt.md",
      content: `---
mode: agent
description: Use KGraph persistent repo intelligence for this request
---

Use KGraph for the current task.

1. If the user provided a topic, run \`kgraph context "<topic>"\` first. If not, infer a concise topic from the request.
2. Use the returned files, symbols, relationships, and cognition before broad repository exploration.
3. If you discover durable architecture, debugging, workflow, or gotcha knowledge, create a Markdown note in \`.kgraph/inbox/\`.
4. If you add an inbox note, run \`kgraph update\`.
5. If code structure changed, run \`kgraph scan\`.
`
    },
    {
      path: ".github/prompts/kgraph-update.prompt.md",
      content: `---
mode: agent
description: Preserve recent useful chat knowledge in KGraph
---

Create a concise Markdown cognition note in \`.kgraph/inbox/\` from the useful stable knowledge in this conversation, then run \`kgraph update\`.

Capture only durable information: architecture discoveries, debugging conclusions, workflow conventions, important files, important functions, and gotchas. Do not store temporary chatter.
`
    },
    {
      path: ".github/prompts/kgraph-scan.prompt.md",
      content: `---
mode: agent
description: Refresh KGraph structural maps after repository changes
---

Run \`kgraph scan\` and report the number of files and symbols scanned. If scan output suggests generated/cache files were included, mention that the exclude configuration may need adjustment.
`
    }
  ]
};
