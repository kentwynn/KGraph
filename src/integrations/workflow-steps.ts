/**
 * Shared KGraph workflow step strings used across all AI tool adapters.
 * Update here once instead of in each adapter file.
 */

const DECISION_CONTEXT = `## Feature intent — choose based on the situation

**Sessions** exist to preserve the journey when exploration, evaluation, or multi-step reasoning produced knowledge that the outcome alone cannot capture. The path matters when a future agent might face the same fork.

**Inbox notes** exist for structured multi-section knowledge that cannot fit a single --capture sentence. Architecture decisions with rationale, multi-file change summaries with interconnections, or design tradeoffs with rejected alternatives.

**--capture / conclude** exists for atomic durable conclusions — one sentence, evidence-linked. Prefer this for most captures.

**--domain and --tag** exist so future queries find knowledge by area, not just by word match. Add them when the knowledge clearly belongs to an identifiable architectural boundary.

**knowledge supersede** exists to evolve knowledge without duplicating. When new understanding contradicts or refines an existing atom, supersede it.

**stale** exists to surface atoms whose evidence no longer holds. Consider it after your edits touched code that pack showed as atom-referenced.

**impact** exists to reveal blast radius. Consider it before destructive changes to public interfaces — renames, deletions, signature changes.

**compact** exists to merge redundant knowledge. Consider it when you store something that feels overlapping with what pack already showed.

**scan** exists to refresh maps after structural changes. The root workflow handles this automatically unless you created, deleted, or renamed many files outside of kgraph commands.

**history** exists to answer "what did we do" and "when did this happen" questions. Use \`kgraph history "<topic>"\` when the user asks about prior work, decisions, or the sequence of changes — it covers the full timeline regardless of whether knowledge was captured via \`conclude\`, \`--capture\`, or inbox notes. Use \`kgraph knowledge list\` when the user wants the structured claim and evidence for an atom. Use \`kgraph pack\` when the user needs context to start or continue coding work. These three serve different intents: timeline vs. structured memory vs. coding context.

**budget** exists to control how much source context pack delivers. On large or complex projects, raise \`--budget\` (e.g. \`--budget 16000\`) when pack omits files or symbols that feel relevant — the default 8000 was tuned for small projects. When pack includes file items with a \`content\` field, the budget was already spent delivering that source inline; do not re-read those files.`;

const DOCTOR_STEP = `Run \`kgraph doctor\` when setup, maps, inbox processing, or integrations look wrong. Run \`kgraph doctor --quality\` when context shows stale/noisy cognition references.`;
const IMPACT_STEP = `Run \`kgraph impact "<file-or-symbol>"\` when the user asks what a change may affect. Run \`kgraph history "<topic>"\` when the user asks what was done before, who made a decision, or what the sequence of changes was.`;
const REPAIR_STEP = `Run \`kgraph repair --dry-run\` before cleanup when stale/noisy atom refs need fixing. Run \`kgraph repair\` only when the user asks to apply that cleanup.`;
const COMPACT_STEP = `Run \`kgraph compact --dry-run\` when cognition looks duplicated, noisy, or stale. Run \`kgraph compact\` only when the user asks to merge/archive cognition.`;
const HISTORY_STEP = `Run \`kgraph history "<topic>"\` when the user asks what was done, decided, or changed — it covers the full timeline including notes captured via \`conclude\`, \`--capture\`, and inbox. Prefer history over \`knowledge list\` when the question is about sequence, timing, or authorship rather than atom details.`;
const KNOWLEDGE_STEP = `Run \`kgraph knowledge list --topic "<topic>"\` or \`kgraph knowledge get <atom-id>\` when the user asks what KGraph remembers or atom provenance/lifecycle matters.`;
const STALE_STEP = `Run \`kgraph stale\` when changed or deleted code may have invalidated durable knowledge. Run \`kgraph blame <atom-id>\` when provenance or evidence for a memory matters.`;
const EXPLORATION_BOUNDARY_STEP = `Keep exploration bounded by the task. For simple edits, use KGraph to identify the likely file, then read only that file or a narrow range and make the edit. Do not keep searching after the target file is found, do not retry malformed shell commands with broader variants, and do not run broad \`find\`, recursive \`grep\`, or repeated full-file dumps after KGraph already returned candidate files.`;
const VERIFY_EDIT_STEP = `After editing, verify the change actually landed before claiming completion. Prefer a narrow read of the changed range or \`git diff -- <path>\`; if there is no diff or the expected text is missing, say the edit did not apply and fix it before summarizing.`;
const SCAN_STEP = `After bulk file creation, deletion, or rename (3+ files), run \`kgraph scan\` before the next \`kgraph pack\` so maps stay accurate.`;
function smartRootStep(agentName: string): string {
  return `Use the root workflow when refresh or memory processing matters: run \`kgraph "<topic>" --agent ${agentName}\` to refresh maps, process inbox notes, and return a briefing; run \`kgraph "<topic>" --final --agent ${agentName}\` before the final answer when repository files changed; run \`kgraph "<topic>" --capture "<durable conclusion>" --capture-file <path> --capture-symbol <name> --agent ${agentName}\` when the final check requires durable knowledge.`;
}

function sessionStep(agentName: string, qualifier?: string): string {
  const base = `Track meaningful session activity with \`kgraph session start --agent ${agentName}\`, \`kgraph session read <path> --agent ${agentName}\`, \`kgraph session write <path> --agent ${agentName}\`, and \`kgraph session end --agent ${agentName} --conclude --topic "<topic>"\` when durable session memory is useful`;
  return qualifier ? `${base} ${qualifier}.` : `${base}.`;
}

export interface WorkflowOptions {
  /** Qualifier appended to the session step, e.g. "when native hooks are unavailable" */
  sessionQualifier?: string;
}

/**
 * Returns the numbered workflow for skill/agent/command files.
 * Used by: copilot (agent file), codex (skill file), claude-code (command file).
 */
export function numberedWorkflow(
  agentName: string,
  options: WorkflowOptions = {},
): string {
  return `1. Infer the topic from the user's request.
2. {{KGRAPH_CONTEXT_POLICY}}
3. When a pack item includes an \`excerpt\` field (symbol) or a \`content\` field (file), you already have the source code inline — do not read that file separately. Items in the \`omitted\` array were evaluated and excluded — do not manually search for them unless the user explicitly asks.
4. ${EXPLORATION_BOUNDARY_STEP}
5. ${VERIFY_EDIT_STEP}
6. ${smartRootStep(agentName)}
7. ${KNOWLEDGE_STEP}
8. ${DOCTOR_STEP}
9. ${STALE_STEP}
10. ${SCAN_STEP}
11. ${sessionStep(agentName, options.sessionQualifier)}
12. ${IMPACT_STEP}

{{KGRAPH_CAPTURE_POLICY}}

13. ${REPAIR_STEP}
14. ${COMPACT_STEP}
15. Run \`kgraph visualize\` when the user wants to inspect the dependency graph — opens an interactive graph locally with PNG export.
16. ${HISTORY_STEP}

${DECISION_CONTEXT}`;
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
- When a pack item includes an \`excerpt\` field (symbol) or a \`content\` field (file), you already have the source code inline — do not read that file separately. Items in the \`omitted\` array were evaluated and excluded — do not manually search for them unless the user explicitly asks.
- ${EXPLORATION_BOUNDARY_STEP}
- ${VERIFY_EDIT_STEP}
- ${smartRootStep(agentName)}
- ${KNOWLEDGE_STEP}
- ${DOCTOR_STEP}
- ${STALE_STEP}
- ${SCAN_STEP}
- ${sessionStep(agentName, options.sessionQualifier)}
- ${IMPACT_STEP}
{{KGRAPH_CAPTURE_POLICY}}
- ${REPAIR_STEP}
- ${COMPACT_STEP}
- Run \`kgraph visualize\` to open the interactive dependency graph locally with PNG export.
- ${HISTORY_STEP}

${DECISION_CONTEXT}`;
}
