export function estimateTokens(content: string, filePath = ''): number {
  if (content.length === 0) {
    return 0;
  }
  const ratio = tokenRatio(filePath);
  return Math.max(1, Math.ceil(content.length / ratio));
}

function tokenRatio(filePath: string): number {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.md') || lower.endsWith('.txt')) return 4.8;
  if (lower.endsWith('.json') || lower.endsWith('.yaml') || lower.endsWith('.yml')) return 3.8;
  if (lower.endsWith('.html') || lower.endsWith('.css')) return 3.6;
  return 4.0;
}
