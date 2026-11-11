export interface Ranked<T> {
  item: T;
  score: number;
  reasons: string[];
  /** Matched only through prefix stems, never a query word. */
  stemOnly?: boolean;
}

export function tokenize(query: string): string[] {
  return expandTokens(queryWords(query));
}

// Case is kept so camelCase words can be split: `consumeReturnUrl` also gives consume, return, url.
function queryWords(query: string): string[] {
  return query
    .split(/[^A-Za-z0-9_$./-]+/)
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
  const stems = stemTokens(query);
  const ranked = items
    .map((item) => {
      let score = 0;
      let realMatch = false;
      const reasons: string[] = [];
      for (const field of fields) {
        const value = field.value(item);
        const values = Array.isArray(value) ? value : value ? [value] : [];
        const haystack = values
          .flatMap((value) => [value, splitIdentifier(value).join(' ')])
          .join(' ')
          .toLowerCase();
        for (const token of tokens) {
          if (haystack.includes(token)) {
            const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (stems.has(token)) {
              // A stem is a guess at a related word: weak, and only at the start of a word.
              if (new RegExp(`\\b${escaped}`).test(haystack)) {
                score += 1;
                reasons.push(`${field.name} matched stem "${token}"`);
              }
              continue;
            }
            const baseScore =
              field.name === 'path' || field.name === 'name'
                ? 4
                : field.name === 'summary' || field.name === 'title'
                  ? 2
                  : 1;
            const wordBoundary = new RegExp(`\\b${escaped}\\b`).test(haystack);
            const exactValue = values.some(
              (value) => value.toLowerCase() === token,
            );
            score += baseScore + (wordBoundary ? 2 : 0) + (exactValue ? 4 : 0);
            realMatch = true;
            reasons.push(
              `${field.name} matched "${token}"${wordBoundary || exactValue ? ' (exact)' : ''}`,
            );
          }
        }
      }
      return { item, score, reasons, stemOnly: score > 0 && !realMatch };
    })
    .filter((ranked) => ranked.score > 0)
    .sort((a, b) => b.score - a.score);
  // Stem guesses are only worth showing when no query word matched anything.
  return ranked.some((r) => !r.stemOnly) ? ranked.filter((r) => !r.stemOnly) : ranked;
}

function expandTokens(tokens: string[]): string[] {
  return [
    ...new Set(
      tokens.flatMap((token) => [
        token.toLowerCase(),
        ...splitIdentifier(token),
        ...prefixStems(token.toLowerCase()),
      ]),
    ),
  ];
}

/** Prefix stems that are not also a real word or identifier part of the query. */
function stemTokens(query: string): Set<string> {
  const words = queryWords(query);
  const real = new Set(words.flatMap((word) => [word.toLowerCase(), ...splitIdentifier(word)]));
  return new Set(
    words.flatMap((word) => prefixStems(word.toLowerCase())).filter((stem) => !real.has(stem)),
  );
}

// Prefix stems so "authentication" also matches "auth" and "configuration" matches "config":
// a 4-character stem and a half-length stem, only for tokens of 8+ characters.
function prefixStems(token: string): string[] {
  if (token.length < 8) return [];
  const stems = [token.slice(0, 4)];
  const half = Math.floor(token.length * 0.5);
  if (half > 4) stems.push(token.slice(0, half));
  return stems;
}

function splitIdentifier(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9_$]+/)
    .map((part) => part.toLowerCase())
    .filter((part) => part.length > 1);
}
