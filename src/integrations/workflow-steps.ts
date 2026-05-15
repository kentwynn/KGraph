/**
 * Shared KGraph workflow step strings used across all AI tool adapters.
 * Update here once instead of in each adapter file.
 */

const DOCTOR_STEP = `Run \`kgraph doctor\` when setup, maps, inbox processing, or integrations look wrong. Run \`kgraph doctor --quality\` when context shows stale/noisy cognition references.`;
const IMPACT_STEP = `Run \`kgraph impact "<file-or-symbol>"\` when the user asks what a change may affect. Run \`kgraph history "<topic>"\` when prior work or decisions matter.`;
const REPAIR_STEP = `Run \`kgraph repair --dry-run\` before cleanup when stale/noisy atom refs need fixing. Run \`kgraph repair\` only when the user asks to apply that cleanup.`;
const COMPACT_STEP = `Run \`kgraph compact --dry-run\` when cognition looks duplicated, noisy, or stale. Run \`kgraph compact\` only when the user asks to merge/archive cognition.`;
const HISTORY_STEP = `Run \`kgraph history\` or \`kgraph history "<topic>"\` to review past cognition sessions with git author attribution.`;
const KNOWLEDGE_STEP = `Run \`kgraph knowledge list --topic "<topic>"\` or \`kgraph knowledge get <atom-id>\` when the user asks what KGraph remembers or atom provenance/lifecycle matters.`;
const PACK_STEP = `Treat \`kgraph pack "<task>" --budget 8000 --json\` as the primary agent contract: use atoms, source ranges, git changes, omitted items, and inclusion reasons from the ContextPack before reading files. Use human \`kgraph "<topic>"\` output only when the user explicitly wants a briefing.`;
const SMART_ROOT_STEP = `Prefer the root workflow for normal agent work: run \`kgraph "<topic>"\` to refresh maps, process cognition, report memory health, and return context; run \`kgraph "<topic>" --final\` before the final answer when repository files changed; run \`kgraph "<topic>" --capture "<durable conclusion>" --capture-file <path> --capture-symbol <name>\` when the final check requires durable knowledge.`;
const STALE_STEP = `Run \`kgraph stale\` when changed or deleted code may have invalidated durable knowledge. Run \`kgraph blame <atom-id>\` when provenance or evidence for a memory matters.`;
const EXPLORATION_BOUNDARY_STEP = `Keep exploration bounded by the task. For simple edits, use KGraph to identify the likely file, then read only that file or a narrow range and make the edit. Do not keep searching after the target file is found, do not retry malformed shell commands with broader variants, and do not run broad \`find\`, recursive \`grep\`, or repeated full-file dumps after KGraph already returned candidate files. Use \`rg --files\` and quoted paths when a path must be located.`;
const VERIFY_EDIT_STEP = `After editing, verify the change actually landed before claiming completion. Prefer a narrow read of the changed range or \`git diff -- <path>\`; if there is no diff or the expected text is missing, say the edit did not apply and fix it before summarizing.`;

function sessionStep(agentName: string, qualifier?: string): string {
  const base = `Track meaningful session activity with \`kgraph session start --agent ${agentName}\`, \`kgraph session read <path> --agent ${agentName}\`, \`kgraph session write <path> --agent ${agentName}\`, and \`kgraph session end --agent ${agentName} --conclude --topic "<topic>"\` when durable session memory is useful`;
  return qualifier ? `${base} ${qualifier}.` : `${base}.`;
}

export interface WorkflowOptions {
  /** Qualifier appended to the session step, e.g. "when native hooks are unavailable" */
  sessionQualifier?: string;
}

/**
 * Returns the 9-step numbered workflow for skill/agent/command files.
 * Used by: copilot (agent file), codex (skill file), claude-code (command file).
 */
export function numberedWorkflow(
  agentName: string,
  options: WorkflowOptions = {},
): string {
  return `1. Infer the topic from the user's request.
2. {{KGRAPH_CONTEXT_POLICY}}
3. Use the returned files, symbols, relationships, and cognition before broad exploration.
4. ${EXPLORATION_BOUNDARY_STEP}
5. ${VERIFY_EDIT_STEP}
6. ${SMART_ROOT_STEP}
7. ${PACK_STEP}
8. ${KNOWLEDGE_STEP}
9. ${DOCTOR_STEP}
10. ${STALE_STEP}
11. ${sessionStep(agentName, options.sessionQualifier)}
12. ${IMPACT_STEP}

{{KGRAPH_CAPTURE_POLICY}}

13. ${REPAIR_STEP}
14. ${COMPACT_STEP}
15. Run \`kgraph visualize\` when the user wants to inspect the dependency graph — opens an interactive graph at http://localhost:4242 with PNG export.
16. ${HISTORY_STEP}`;
}

/**
 * Returns the bullet-list workflow for rules files.
 * Used by: cursor, cline, windsurf, gemini.
 */
export function bulletWorkflow(
  agentName: string,
  options: WorkflowOptions = {},
): string {
  return `- {{KGRAPH_CONTEXT_POLICY}}
- ${EXPLORATION_BOUNDARY_STEP}
- ${VERIFY_EDIT_STEP}
- ${SMART_ROOT_STEP}
- ${PACK_STEP}
- ${KNOWLEDGE_STEP}
- ${DOCTOR_STEP}
- ${STALE_STEP}
- ${sessionStep(agentName, options.sessionQualifier)}
- ${IMPACT_STEP}
{{KGRAPH_CAPTURE_POLICY}}
- ${REPAIR_STEP}
- ${COMPACT_STEP}
- Run \`kgraph visualize\` to open the interactive dependency graph at http://localhost:4242 with PNG export.
- ${HISTORY_STEP}`;
}
