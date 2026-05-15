/**
 * Shared agent skill definitions used by any integration that writes
 * `.agents/skills/` SKILL.md files (copilot, codex, etc.).
 *
 * Per-command skills are agent-name-agnostic.
 * The main kgraph workflow skill is parameterised by agent name.
 */

import type { IntegrationCommandFile } from './integration-registry.js';
import { numberedWorkflow } from './workflow-steps.js';

/** Per-command skills shared across all agent-skill integrations. */
export const SHARED_AGENT_SKILLS: IntegrationCommandFile[] = [
  {
    path: '.agents/skills/kgraph-doctor/SKILL.md',
    content: `---
name: kgraph-doctor
description: Check KGraph workspace health and next actions
---

Run \`kgraph doctor\` to check whether the workspace is initialized, maps exist, inbox notes are pending, and configured integrations point to real files. Use \`kgraph doctor --quality\` when the user asks about stale or noisy cognition references. Summarize any failed checks and the next command to run.
`,
  },
  {
    path: '.agents/skills/kgraph-repair/SKILL.md',
    content: `---
name: kgraph-repair
description: Preview or clean stale/noisy KGraph cognition references
---

Run \`kgraph repair --dry-run\` first and summarize the proposed atom-reference cleanup. Run \`kgraph repair\` only when the user asks to apply the cleanup.
`,
  },
  {
    path: '.agents/skills/kgraph-compact/SKILL.md',
    content: `---
name: kgraph-compact
description: Merge duplicate KGraph cognition and archive stale low-value entries
---

Run \`kgraph compact --dry-run\` first and summarize duplicate cognition groups and stale low-confidence notes. Run \`kgraph compact\` only when the user asks to apply compaction.
`,
  },
  {
    path: '.agents/skills/kgraph-pack/SKILL.md',
    content: `---
name: kgraph-pack
description: Build a budget-aware KGraph context pack
---

Run \`kgraph pack "$ARGUMENTS" --budget 8000 --json\` to build a machine-readable context pack. Summarize token use, included files, symbols, relationships, git changes, session history, atoms, and omitted items with the inclusion reasons.
`,
  },
  {
    path: '.agents/skills/kgraph-knowledge/SKILL.md',
    content: `---
name: kgraph-knowledge
description: Inspect or manage KGraph canonical knowledge atoms
---

Use \`kgraph knowledge list\` and \`kgraph knowledge get <atom-id>\` to inspect durable atoms, evidence, provenance, and lifecycle. Run \`kgraph knowledge archive <atom-id>\` or \`kgraph knowledge supersede <old-id> <new-id>\` only when the user explicitly asks to mutate atom lifecycle.
`,
  },
  {
    path: '.agents/skills/kgraph-stale/SKILL.md',
    content: `---
name: kgraph-stale
description: Show KGraph knowledge invalidated by changed or missing refs
---

Run \`kgraph stale\` to refresh atom status against the current scan and summarize stale or needs-review atoms with invalidation reasons.
`,
  },
  {
    path: '.agents/skills/kgraph-blame/SKILL.md',
    content: `---
name: kgraph-blame
description: Show KGraph atom provenance and evidence
---

Run \`kgraph blame "$ARGUMENTS"\` to show who or what created a knowledge atom, the source command/session/commit, evidence refs, and lifecycle links.
`,
  },
  {
    path: '.agents/skills/kgraph-scan/SKILL.md',
    content: `---
name: kgraph-scan
description: Refresh KGraph file, symbol, import, and relationship maps
---

Run \`kgraph scan\` to refresh the repository maps, then summarize what changed.
`,
  },
  {
    path: '.agents/skills/kgraph-update/SKILL.md',
    content: `---
name: kgraph-update
description: Process KGraph inbox notes into durable cognition
---

Run \`kgraph update\` to process any pending Markdown notes in \`.kgraph/inbox/\` into durable cognition.
`,
  },
  {
    path: '.agents/skills/kgraph-visualize/SKILL.md',
    content: `---
name: kgraph-visualize
description: Open interactive KGraph dependency graph in browser
---

Run \`kgraph visualize\` to start the interactive dependency graph at http://localhost:4242, then summarize what nodes and connections are visible.
`,
  },
  {
    path: '.agents/skills/kgraph-capture/SKILL.md',
    content: `---
name: kgraph-capture
description: Save what was just built or changed into KGraph cognition
---

Capture this session into KGraph cognition.

{{KGRAPH_CAPTURE_POLICY}}
`,
  },
  {
    path: '.agents/skills/kgraph-conclude/SKILL.md',
    content: `---
name: kgraph-conclude
description: Store a typed durable KGraph engineering conclusion
---

Prefer \`kgraph "<topic>" --capture "$ARGUMENTS" --capture-file <path> --capture-symbol <name>\` when the session produced reusable engineering knowledge. Use low-level \`kgraph conclude "$ARGUMENTS"\` only when the user explicitly asks for the conclude command. Choose one type from finding, decision, gotcha, summary, relationship, and one confidence from high, medium, low. Add file or symbol evidence whenever possible; high-confidence conclusions require evidence. Store only durable conclusions, not raw chain-of-thought, temporary reasoning, speculative exploration, or low-value observations.
`,
  },
  {
    path: '.agents/skills/kgraph-impact/SKILL.md',
    content: `---
name: kgraph-impact
description: Show KGraph change impact for a file, symbol, or topic
---

Run \`kgraph impact "$ARGUMENTS"\` to show matched files/symbols, import users, callers, callees, related knowledge atoms, and risk hints.
`,
  },
  {
    path: '.agents/skills/kgraph-session/SKILL.md',
    content: `---
name: kgraph-session
description: Track KGraph session read/write activity and token estimates
---

Use \`kgraph session\` to inspect current session activity. Record meaningful events with \`kgraph session start --agent $AGENT\`, \`kgraph session read <path> --agent $AGENT\`, \`kgraph session write <path> --agent $AGENT\`, and \`kgraph session end --agent $AGENT --conclude --topic "<topic>"\` when durable session memory is useful.
`,
  },
  {
    path: '.agents/skills/kgraph-history/SKILL.md',
    content: `---
name: kgraph-history
description: Show timeline of KGraph cognition sessions with git attribution
---

Run \`kgraph history\` or \`kgraph history "$ARGUMENTS"\` to display processed cognition sessions. Summarize who contributed what and when. Use \`--last <n>\` to limit entries.
`,
  },
];

/**
 * Build the full agent skill list for an adapter: the main workflow skill
 * (parameterised by agent name) plus all shared per-command skills.
 */
export function agentSkillFiles(agentName: string): IntegrationCommandFile[] {
  return [
    {
      path: '.agents/skills/kgraph/SKILL.md',
      content: `---
name: kgraph
description: Use KGraph persistent repo intelligence according to the configured integration mode. Use when asked about repo structure, debugging context, architecture decisions, or to avoid rediscovering what is already known.
---

# KGraph Skill

Workflow:

${numberedWorkflow(agentName)}
`,
    },
    ...SHARED_AGENT_SKILLS,
  ];
}
