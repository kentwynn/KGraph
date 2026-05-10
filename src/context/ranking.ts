export interface Ranked<T> {
  item: T;
  score: number;
  reasons: string[];
}

export function tokenize(query: string): string[] {
  return expandTokens(
    query
    .toLowerCase()
    .split(/[^a-z0-9_$./-]+/)
    .map((token) => token.trim())
      .filter(Boolean),
  );
}

export function rankByFields<T>(
  query: string,
  items: T[],
  fields: Array<{
    name: string;
    value: (item: T) => string | string[] | undefined;
  }>,
): Ranked<T>[] {
  const tokens = tokenize(query);
  return items
    .map((item) => {
      let score = 0;
      const reasons: string[] = [];
      for (const field of fields) {
        const value = field.value(item);
        const values = Array.isArray(value) ? value : value ? [value] : [];
        const haystack = values.flatMap((value) => [value, splitIdentifier(value).join(' ')]).join(' ').toLowerCase();
        for (const token of tokens) {
          if (haystack.includes(token)) {
            const baseScore =
              field.name === 'path' || field.name === 'name'
                ? 4
                : field.name === 'summary' || field.name === 'title'
                  ? 2
                  : 1;
            const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const wordBoundary = new RegExp(`\\b${escaped}\\b`).test(haystack);
            const exactValue = values.some((value) => value.toLowerCase() === token);
            score += baseScore + (wordBoundary ? 2 : 0) + (exactValue ? 4 : 0);
            reasons.push(
              `${field.name} matched "${token}"${wordBoundary || exactValue ? ' (exact)' : ''}`,
            );
          }
        }
      }
      return { item, score, reasons };
    })
    .filter((ranked) => ranked.score > 0)
    .sort((a, b) => b.score - a.score);
}

function expandTokens(tokens: string[]): string[] {
  return [...new Set(tokens.flatMap((token) => [token, ...splitIdentifier(token)]))];
}

function splitIdentifier(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9_$]+/)
    .map((part) => part.toLowerCase())
    .filter((part) => part.length > 1);
}
