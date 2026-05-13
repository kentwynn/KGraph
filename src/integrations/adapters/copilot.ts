import type { IntegrationAdapter } from '../integration-registry.js';
import { numberedWorkflow } from '../workflow-steps.js';

export const copilotAdapter: IntegrationAdapter = {
  name: 'copilot',
  label: 'GitHub Copilot',
  targetPath: '.github/copilot-instructions.md',
  instructions: `## KGraph Workflow

${numberedWorkflow('copilot')}
`,
  commandFiles: [
    {
      path: '.github/agents/kgraph.agent.md',
      content: `---
name: kgraph
description: Use KGraph persistent repo intelligence to answer questions about this codebase. Runs kgraph context, pack, knowledge, stale, blame, scan, update, conclude, compact, impact, history, and session commands to ground responses in durable local knowledge.
tools:
  - run_in_terminal
  - read_file
  - file_search
  - grep_search
  - semantic_search
---

## KGraph Agent

You are a KGraph-powered agent. Before exploring the repository freely, always:

${numberedWorkflow('copilot')}
`,
    },
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

Run \`kgraph repair --dry-run\` first and summarize the proposed atom-reference cleanup. Run \`kgraph repair\` only when the user asks to apply the cleanup.
`,
    },
    {
      path: '.github/prompts/kgraph-compact.prompt.md',
      content: `---
description: Merge duplicate KGraph cognition and archive stale low-value entries
agent: agent
argument-hint: "--dry-run or apply"
---

Run \`kgraph compact --dry-run\` first and summarize duplicate cognition groups and stale low-confidence notes. Run \`kgraph compact\` only when the user asks to apply compaction.
`,
    },
    {
      path: '.github/prompts/kgraph-pack.prompt.md',
      content: `---
description: Build a budget-aware KGraph context pack
agent: agent
argument-hint: "Task description"
---

Run \`kgraph pack "$ARGUMENTS" --budget 8000 --json\` to build a machine-readable context pack. Summarize token use, included files, symbols, relationships, git changes, session history, atoms, and omitted items with the inclusion reasons.
`,
    },
    {
      path: '.github/prompts/kgraph-knowledge.prompt.md',
      content: `---
description: Inspect or manage KGraph canonical knowledge atoms
agent: agent
argument-hint: "list, get <atom-id>, archive <atom-id>, or supersede <old-id> <new-id>"
---

Use \`kgraph knowledge list\` and \`kgraph knowledge get <atom-id>\` to inspect durable atoms, evidence, provenance, and lifecycle. Run \`kgraph knowledge archive <atom-id>\` or \`kgraph knowledge supersede <old-id> <new-id>\` only when the user explicitly asks to mutate atom lifecycle.
`,
    },
    {
      path: '.github/prompts/kgraph-stale.prompt.md',
      content: `---
description: Show KGraph knowledge invalidated by changed or missing refs
agent: agent
---

Run \`kgraph stale\` to refresh atom status against the current scan and summarize stale or needs-review atoms with invalidation reasons.
`,
    },
    {
      path: '.github/prompts/kgraph-blame.prompt.md',
      content: `---
description: Show KGraph atom provenance and evidence
agent: agent
argument-hint: "Atom id"
---

Run \`kgraph blame "$ARGUMENTS"\` to show who or what created a knowledge atom, the source command/session/commit, evidence refs, and lifecycle links.
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

{{KGRAPH_CAPTURE_POLICY}}
`,
    },
    {
      path: '.github/prompts/kgraph-conclude.prompt.md',
      content: `---
description: Store a typed durable KGraph engineering conclusion
agent: agent
argument-hint: "Topic plus optional type, confidence, files, and symbols"
---

Use \`kgraph conclude "$ARGUMENTS"\` when the session produced reusable engineering knowledge. Choose one type from finding, decision, gotcha, summary, relationship, and one confidence from high, medium, low. Store only durable conclusions, not raw chain-of-thought, temporary reasoning, speculative exploration, or low-value observations.
`,
    },
    {
      path: '.github/prompts/kgraph-impact.prompt.md',
      content: `---
description: Show KGraph change impact for a file, symbol, or topic
agent: agent
argument-hint: "File, symbol, or topic"
---

Run \`kgraph impact "$ARGUMENTS"\` to show matched files/symbols, import users, callers, callees, related knowledge atoms, and risk hints.
`,
    },
    {
      path: '.github/prompts/kgraph-session.prompt.md',
      content: `---
description: Track KGraph session read/write activity and token estimates
agent: agent
argument-hint: "start, read <path>, write <path>, end, or status"
---

Use \`kgraph session\` to inspect current session activity. Record meaningful events with \`kgraph session start --agent copilot\`, \`kgraph session read <path> --agent copilot\`, \`kgraph session write <path> --agent copilot\`, and \`kgraph session end --agent copilot --conclude --topic "<topic>"\` when durable session memory is useful.
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
  obsoleteCommandFiles: [
    '.github/prompts/kgraph.prompt.md',
    '.github/kgraph.agent.md',
  ],
};
