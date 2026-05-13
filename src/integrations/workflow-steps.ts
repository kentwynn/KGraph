/**
 * Shared KGraph workflow step strings used across all AI tool adapters.
 * Update here once instead of in each adapter file.
 */

const DOCTOR_STEP = `Run \`kgraph doctor\` when setup, maps, inbox processing, or integrations look wrong. Run \`kgraph doctor --quality\` when context shows stale/noisy cognition references.`;
const IMPACT_STEP = `Run \`kgraph impact "<file-or-symbol>"\` when the user asks what a change may affect. Run \`kgraph history "<topic>"\` when prior work or decisions matter.`;
const REPAIR_STEP = `Run \`kgraph repair --dry-run\` before cleanup when stale/noisy cognition needs fixing. Run \`kgraph repair\` only when the user asks to apply that cleanup.`;
const COMPACT_STEP = `Run \`kgraph compact --dry-run\` when cognition looks duplicated, noisy, or stale. Run \`kgraph compact\` only when the user asks to merge/archive cognition.`;
const HISTORY_STEP = `Run \`kgraph history\` or \`kgraph history "<topic>"\` to review past cognition sessions with git author attribution.`;
const KNOWLEDGE_STEP = `Run \`kgraph knowledge list --topic "<topic>"\` or \`kgraph knowledge get <atom-id>\` when the user asks what KGraph remembers or atom provenance/lifecycle matters.`;
const PACK_STEP = `Run \`kgraph pack "<task>" --budget 8000 --json\` when an agent needs a machine-readable, token-budgeted context pack instead of human Markdown context.`;

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
4. ${PACK_STEP}
5. ${KNOWLEDGE_STEP}
6. ${DOCTOR_STEP}
7. ${sessionStep(agentName, options.sessionQualifier)}
8. ${IMPACT_STEP}

{{KGRAPH_CAPTURE_POLICY}}

9. ${REPAIR_STEP}
10. ${COMPACT_STEP}
11. Run \`kgraph visualize\` when the user wants to inspect the dependency graph — opens an interactive graph at http://localhost:4242 with PNG export.
12. ${HISTORY_STEP}`;
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
- ${PACK_STEP}
- ${KNOWLEDGE_STEP}
- ${DOCTOR_STEP}
- ${sessionStep(agentName, options.sessionQualifier)}
- ${IMPACT_STEP}
{{KGRAPH_CAPTURE_POLICY}}
- ${REPAIR_STEP}
- ${COMPACT_STEP}
- Run \`kgraph visualize\` to open the interactive dependency graph at http://localhost:4242 with PNG export.
- ${HISTORY_STEP}`;
}
