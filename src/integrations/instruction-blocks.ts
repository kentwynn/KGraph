import type { IntegrationMode } from '../types/config.js';

const MARKER_PREFIX = '<!--';
const MARKER_SUFFIX = '-->';
export const KGRAPH_CONTEXT_POLICY_PLACEHOLDER = '{{KGRAPH_CONTEXT_POLICY}}';
export const KGRAPH_CAPTURE_POLICY_PLACEHOLDER = '{{KGRAPH_CAPTURE_POLICY}}';

export function upsertManagedBlock(
  content: string,
  integrationName: string,
  instructions: string,
): string {
  const normalized = content.trimEnd();
  const block = renderManagedBlock(integrationName, instructions);
  const pattern = managedBlockPattern(integrationName);
  if (pattern.test(content)) {
    return content.replace(pattern, block);
  }
  return normalized ? `${block}\n\n${normalized}\n` : `${block}\n`;
}

export function removeManagedBlock(
  content: string,
  integrationName: string,
): string {
  return (
    content
      .replace(managedBlockPattern(integrationName), '')
      .replace(/\n{3,}/g, '\n\n')
      .trim() + '\n'
  );
}

function renderManagedBlock(
  integrationName: string,
  instructions: string,
): string {
  return [
    `${MARKER_PREFIX} BEGIN KGRAPH ${integrationName} ${MARKER_SUFFIX}`,
    instructions.trim(),
    `${MARKER_PREFIX} END KGRAPH ${integrationName} ${MARKER_SUFFIX}`,
  ].join('\n');
}

function managedBlockPattern(integrationName: string): RegExp {
  return new RegExp(
    `${escapeRegExp(MARKER_PREFIX)} BEGIN KGRAPH ${escapeRegExp(integrationName)} ${escapeRegExp(MARKER_SUFFIX)}[\\s\\S]*?${escapeRegExp(MARKER_PREFIX)} END KGRAPH ${escapeRegExp(integrationName)} ${escapeRegExp(MARKER_SUFFIX)}\\n?`,
    'm',
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function applyContextPolicy(
  content: string,
  mode: IntegrationMode,
  agentName?: string,
): string {
  return content
    .replaceAll(KGRAPH_CONTEXT_POLICY_PLACEHOLDER, renderContextPolicy(mode, agentName))
    .replaceAll(KGRAPH_CAPTURE_POLICY_PLACEHOLDER, renderCapturePolicy(agentName));
}

export function renderContextPolicy(
  mode: IntegrationMode,
  agentName?: string,
): string {
  const useResultBoundary =
    'Use the returned KGraph ContextPack items as the first-pass source of truth. Prefer source ranges, atoms, git changes, and inclusion reasons from the pack before broad repository search. Do not rerun the same KGraph query just to tail or reformat output, do not continue broad repository search after the target file or range is identified, do not retry malformed shell commands with broader variants, and do not run broad `find`, recursive `grep`, or repeated full-file dumps after KGraph has narrowed the target.';
  const packCommand = agentName
    ? `kgraph pack "<topic>" --budget 8000 --json --agent ${agentName}`
    : 'kgraph pack "<topic>" --budget 8000 --json';
  switch (mode) {
    case 'always':
      return `Every chat in this repository must start by running \`${packCommand}\` before answering or exploring files. Infer the topic from the user's message; no exceptions, including simple or conversational requests. This records a lightweight KGraph session context event for the agent. Use \`kgraph "<topic>"\` only when a human-readable briefing is explicitly needed. ${useResultBoundary}`;
    case 'manual':
      return 'Do not run KGraph automatically. Run `kgraph pack "<topic>" --budget 8000 --json` only when the user explicitly asks for KGraph context, invokes KGraph, or needs a machine-readable repo-memory pack.';
    case 'off':
      return 'KGraph is disabled for this integration.';
    case 'smart':
    default:
      return `For repo-specific coding, debugging, architecture, refactor, review, or file-exploration requests, run \`${packCommand}\` before broad repository exploration. Infer the topic from the user's message. This records a lightweight KGraph session context event only when KGraph is actually used. Skip KGraph for simple conversational requests that do not depend on repo knowledge. Use \`kgraph "<topic>"\` only when a human-readable briefing is explicitly needed. ${useResultBoundary}`;
  }
}

export function renderCapturePolicy(agentName?: string): string {
  const finalCommand = agentName
    ? `kgraph "<topic>" --final --agent ${agentName}`
    : 'kgraph "<topic>" --final';
  const captureCommand = agentName
    ? `kgraph "<topic>" --capture "<durable conclusion>" --capture-file <path> --capture-symbol <name> --agent ${agentName}`
    : 'kgraph "<topic>" --capture "<durable conclusion>" --capture-file <path> --capture-symbol <name>';
  return `Capture policy:
- At the end of any session that changed repository files, run \`${finalCommand}\` before the final response so KGraph can enforce whether capture is required.
- If final check reports capture-required, run \`${captureCommand}\` to store durable engineering memory, or explicitly say "No durable knowledge created" only when there is genuinely no reusable knowledge.
- Low-level alternatives remain available: \`kgraph conclude "<topic>" --type <finding|decision|gotcha|summary|relationship> --confidence <high|medium|low>\` or \`kgraph session end --agent <agent> --conclude --topic "<topic>"\`.
- Add evidence when storing cognition. High-confidence conclusions must include at least one \`--file <path>\` or \`--symbol <name>\`; medium-confidence conclusions should include evidence when possible.
- Preserve only expensive-to-rediscover findings, decisions, gotchas, summaries, and relationships. Do not store raw chain-of-thought, temporary reasoning, speculative exploration, or low-value observations.
- Use \`.kgraph/inbox/<slug>.md\` only when a longer structured note is clearer than a single \`kgraph conclude\` command.
- A \`.kgraph/inbox/*.md\` note is KGraph runtime capture, not project documentation. It is allowed by this workflow unless the user explicitly says not to capture to KGraph.
- Do not skip capture for meaningful UI text, button, link, route, styling, or small file edits. Skip capture only when no reusable repository knowledge was created.
- Do not run KGraph repeatedly. Run it once at the start with \`kgraph pack "<topic>" --budget 8000 --json${agentName ? ` --agent ${agentName}` : ''}\` for agent-readable context. If repo files changed, run \`${finalCommand}\` once before the final answer.
- After the final \`kgraph\` run, mention whether durable cognition was stored or processed.

When using an inbox note, use this structure:
\`\`\`markdown
---
type: finding
confidence: medium
---
# <Short Title>

## Summary
One or two sentences describing what was done.

## Key Files
- \`path/to/file.ts\` - what changed or why it matters

## Key Symbols
- \`FunctionName\` - what changed or why it matters

## Decisions
Any implementation or product decision future sessions should know.
\`\`\``;
}
