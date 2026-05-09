const MARKER_PREFIX = "<!--";
const MARKER_SUFFIX = "-->";

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
