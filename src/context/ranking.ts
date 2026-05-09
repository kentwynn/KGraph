export interface Ranked<T> {
  item: T;
  score: number;
  reasons: string[];
}

export function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9_$./-]+/)
    .map((token) => token.trim())
    .filter(Boolean);
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
        const haystack = values.join(' ').toLowerCase();
        for (const token of tokens) {
          if (haystack.includes(token)) {
            const baseScore =
              field.name === 'path' || field.name === 'name' ? 3 : 1;
            const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const wordBoundary = new RegExp(`\\b${escaped}\\b`).test(haystack);
            score += baseScore + (wordBoundary ? 2 : 0);
            reasons.push(
              `${field.name} matched "${token}"${wordBoundary ? ' (exact)' : ''}`,
            );
          }
        }
      }
      return { item, score, reasons };
    })
    .filter((ranked) => ranked.score > 0)
    .sort((a, b) => b.score - a.score);
}
