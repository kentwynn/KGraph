import type { IntegrationAdapter } from '../integration-registry.js';

export const copilotAdapter: IntegrationAdapter = {
  name: 'copilot',
  label: 'GitHub Copilot',
  targetPath: '.github/copilot-instructions.md',
  instructions: `## KGraph Workflow

1. {{KGRAPH_CONTEXT_POLICY}}
2. Run \`kgraph doctor\` when setup, maps, inbox processing, or integrations look wrong. Run \`kgraph doctor --quality\` when context shows stale/noisy cognition references.
3. Track meaningful session activity with \`kgraph session start --agent copilot\`, \`kgraph session read <path> --agent copilot\`, \`kgraph session write <path> --agent copilot\`, and \`kgraph session end --agent copilot\`.
4. Run \`kgraph impact "<file-or-symbol>"\` when the user asks what a change may affect. Run \`kgraph history "<topic>"\` when prior work or decisions matter.
5. At the end of any session that changed repository files, write one concise Markdown note to \`.kgraph/inbox/<slug>.md\` before finishing.
6. Do not skip capture for UI text, button, link, route, styling, or small file edits. Skip capture only when no repository files changed.
7. Do not run KGraph repeatedly. Run it once at the start with \`kgraph "<topic>"\`. If repo files changed, write the inbox note first, then run \`kgraph\` once at the end.
8. After the final \`kgraph\` run, mention whether the inbox note was processed.
9. Run \`kgraph repair --dry-run\` before cleanup when stale/noisy cognition needs fixing. Run \`kgraph repair\` only when the user asks to apply that cleanup.

The inbox note must use this structure:
\`\`\`markdown
# <Short Title>

## Summary
One or two sentences describing what was done.

## Key Files
- \`path/to/file.ts\` — what it does

## Key Symbols
- \`FunctionName\` — what it does

## Decisions
Any architectural or implementation decisions made.
\`\`\`
`,
  commandFiles: [
    {
      path: '.github/prompts/kgraph-doctor.prompt.md',
      content: `---
description: Check KGraph workspace health and next actions
agent: agent
---

Run \`kgraph doctor\` to check whether the workspace is initialized, maps exist, inbox notes are pending, and configured integrations point to real files. Use \`kgraph doctor --quality\` when the user asks about stale or noisy cognition references. Summarize any failed checks and the next command to run.
`,
    },
    {
      path: '.github/prompts/kgraph-repair.prompt.md',
      content: `---
description: Preview or clean stale/noisy KGraph cognition references
agent: agent
argument-hint: "--dry-run or apply"
---

Run \`kgraph repair --dry-run\` first and summarize the proposed cognition cleanup. Run \`kgraph repair\` only when the user asks to apply the cleanup.
`,
    },
    {
      path: '.github/prompts/kgraph-scan.prompt.md',
      content: `---
description: Refresh KGraph file, symbol, import, and relationship maps
agent: agent
---

Run \`kgraph scan\` to refresh the repository maps, then summarize what changed.
`,
    },
    {
      path: '.github/prompts/kgraph-update.prompt.md',
      content: `---
description: Process KGraph inbox notes into durable cognition
agent: agent
---

Run \`kgraph update\` to process any pending Markdown notes in \`.kgraph/inbox/\` into durable cognition.
`,
    },
    {
      path: '.github/prompts/kgraph-visualize.prompt.md',
      content: `---
description: Open interactive KGraph dependency graph in browser
agent: agent
---

Run \`kgraph visualize\` to start the interactive dependency graph at http://localhost:4242, then summarize what nodes and connections are visible.
`,
    },
    {
      path: '.github/prompts/kgraph-capture.prompt.md',
      content: `---
description: Save what was just built or changed into KGraph cognition
agent: agent
argument-hint: "Brief description of what was done"
---

Capture this session into KGraph cognition.

1. For any completed code or repo-file change, write one Markdown note to \`.kgraph/inbox/<slug>.md\` using the structure below.
2. Do not skip capture for UI text, button, link, route, styling, or small file edits. Skip capture only when no repository files changed.
3. Use the user's message as context, but keep the note factual and concise.
4. Run \`kgraph\` once to process the note and refresh maps. Use \`kgraph update\` only when you intentionally want inbox processing without a scan.

Note structure:
\`\`\`markdown
# <Short Title>

## Summary
One or two sentences describing what was done.

## Key Files
- \`path/to/file.ts\` — what it does

## Key Symbols
- \`FunctionName\` — what it does

## Decisions
Any architectural or implementation decisions made.
\`\`\`
`,
    },
    {
      path: '.github/prompts/kgraph-impact.prompt.md',
      content: `---
description: Show KGraph change impact for a file, symbol, or topic
agent: agent
argument-hint: "File, symbol, or topic"
---

Run \`kgraph impact "$ARGUMENTS"\` to show matched files/symbols, import users, callers, callees, related cognition, and risk hints.
`,
    },
    {
      path: '.github/prompts/kgraph-session.prompt.md',
      content: `---
description: Track KGraph session read/write activity and token estimates
agent: agent
argument-hint: "start, read <path>, write <path>, end, or status"
---

Use \`kgraph session\` to inspect current session activity. Record meaningful events with \`kgraph session start --agent copilot\`, \`kgraph session read <path> --agent copilot\`, \`kgraph session write <path> --agent copilot\`, and \`kgraph session end --agent copilot\`.
`,
    },
    {
      path: '.github/prompts/kgraph-history.prompt.md',
      content: `---
description: Show timeline of KGraph cognition sessions with git attribution
agent: agent
argument-hint: "Optional topic"
---

Run \`kgraph history\` or \`kgraph history "$ARGUMENTS"\` to display processed cognition sessions. Summarize who contributed what and when. Use \`--last <n>\` to limit entries.
`,
    },
  ],
  obsoleteCommandFiles: ['.github/prompts/kgraph.prompt.md'],
};
