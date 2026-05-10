import type { IntegrationMode } from "../types/config.js";

const MARKER_PREFIX = "<!--";
const MARKER_SUFFIX = "-->";
export const KGRAPH_CONTEXT_POLICY_PLACEHOLDER = "{{KGRAPH_CONTEXT_POLICY}}";

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
  return content.replaceAll(KGRAPH_CONTEXT_POLICY_PLACEHOLDER, renderContextPolicy(mode));
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
