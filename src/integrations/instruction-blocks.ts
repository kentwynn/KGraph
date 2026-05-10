import type { IntegrationMode } from "../types/config.js";

const MARKER_PREFIX = "<!--";
const MARKER_SUFFIX = "-->";
export const KGRAPH_CONTEXT_POLICY_PLACEHOLDER = "{{KGRAPH_CONTEXT_POLICY}}";
export const KGRAPH_CAPTURE_POLICY_PLACEHOLDER = "{{KGRAPH_CAPTURE_POLICY}}";

export function upsertManagedBlock(content: string, integrationName: string, instructions: string): string {
  const normalized = content.trimEnd();
  const block = renderManagedBlock(integrationName, instructions);
  const pattern = managedBlockPattern(integrationName);
  if (pattern.test(content)) {
    return content.replace(pattern, block);
  }
  return `${normalized}${normalized ? "\n\n" : ""}${block}\n`;
}

export function removeManagedBlock(content: string, integrationName: string): string {
  return content.replace(managedBlockPattern(integrationName), "").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

function renderManagedBlock(integrationName: string, instructions: string): string {
  return [
    `${MARKER_PREFIX} BEGIN KGRAPH ${integrationName} ${MARKER_SUFFIX}`,
    instructions.trim(),
    `${MARKER_PREFIX} END KGRAPH ${integrationName} ${MARKER_SUFFIX}`
  ].join("\n");
}

function managedBlockPattern(integrationName: string): RegExp {
  return new RegExp(
    `${escapeRegExp(MARKER_PREFIX)} BEGIN KGRAPH ${escapeRegExp(integrationName)} ${escapeRegExp(MARKER_SUFFIX)}[\\s\\S]*?${escapeRegExp(MARKER_PREFIX)} END KGRAPH ${escapeRegExp(integrationName)} ${escapeRegExp(MARKER_SUFFIX)}\\n?`,
    "m"
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function applyContextPolicy(content: string, mode: IntegrationMode): string {
  return content
    .replaceAll(KGRAPH_CONTEXT_POLICY_PLACEHOLDER, renderContextPolicy(mode))
    .replaceAll(KGRAPH_CAPTURE_POLICY_PLACEHOLDER, renderCapturePolicy());
}

export function renderContextPolicy(mode: IntegrationMode): string {
  switch (mode) {
    case "always":
      return 'Every chat in this repository must start by running `kgraph "<topic>"` before answering or exploring files. Infer the topic from the user\'s message; no exceptions, including simple or conversational requests.';
    case "manual":
      return 'Do not run KGraph automatically. Run `kgraph "<topic>"` only when the user explicitly asks for KGraph context or invokes the KGraph command.';
    case "off":
      return "KGraph is disabled for this integration.";
    case "smart":
    default:
      return 'For repo-specific coding, debugging, architecture, refactor, review, or file-exploration requests, run `kgraph "<topic>"` before broad repository exploration. Infer the topic from the user\'s message. Skip KGraph for simple conversational requests that do not depend on repo knowledge.';
  }
}

export function renderCapturePolicy(): string {
  return `Capture policy:
- At the end of any session that changed repository files, write one concise Markdown note to \`.kgraph/inbox/<slug>.md\` before finishing.
- A \`.kgraph/inbox/*.md\` note is KGraph runtime capture, not project documentation. It is allowed and required by this workflow unless the user explicitly says not to capture to KGraph.
- Do not skip capture for UI text, button, link, route, styling, or small file edits. Skip capture only when no repository files changed.
- Do not run KGraph repeatedly. Run it once at the start with \`kgraph "<topic>"\`. If repo files changed, write the inbox note first, then run \`kgraph\` once at the end.
- After the final \`kgraph\` run, mention whether the inbox note was processed.

The inbox note must use this structure:
\`\`\`markdown
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
