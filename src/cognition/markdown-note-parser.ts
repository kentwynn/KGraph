import YAML from 'yaml';
import type { ParsedCognitionNote } from '../types/cognition.js';

const PATH_REF =
  /(?:^|\s|`?)([\w./-]+\.(?:ts|tsx|js|jsx|json|md|yaml|yml))(?:\s|$|[),.;`])/g;

export function parseMarkdownNote(markdown: string): ParsedCognitionNote {
  const normalized = markdown.replace(/\r\n/g, '\n');
  const warnings: string[] = [];
  const { frontmatter, body } = splitFrontmatter(normalized, warnings);
  const sections = parseSections(body);
  const frontmatterTitle =
    typeof frontmatter.title === 'string' ? frontmatter.title : undefined;
  const title =
    extractTitle(body) ?? frontmatterTitle ?? 'Untitled Cognition Note';
  const combined = Object.values(sections).join('\n');

  return {
    title,
    domain:
      typeof frontmatter.domain === 'string' ? frontmatter.domain : undefined,
    tags: Array.isArray(frontmatter.tags) ? frontmatter.tags.map(String) : [],
    summary: sections.Summary,
    sections,
    relatedFiles: unique(extractMatches(stripCodeFences(combined), PATH_REF)),
    relatedSymbols: unique(extractSymbolRefs(sections)),
    warnings,
  };
}

function splitFrontmatter(
  markdown: string,
  warnings: string[],
): { frontmatter: Record<string, unknown>; body: string } {
  if (!markdown.startsWith('---\n')) {
    return { frontmatter: {}, body: markdown };
  }

  const end = markdown.indexOf('\n---', 4);
  if (end === -1) {
    warnings.push('Frontmatter start found without closing delimiter.');
    return { frontmatter: {}, body: markdown };
  }

  try {
    return {
      frontmatter: (YAML.parse(markdown.slice(4, end)) ?? {}) as Record<
        string,
        unknown
      >,
      body: markdown.slice(end + 4),
    };
  } catch (error) {
    warnings.push(
      `Invalid frontmatter: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { frontmatter: {}, body: markdown.slice(end + 4) };
  }
}

function extractTitle(body: string): string | undefined {
  return body.match(/^#\s+(.+)$/m)?.[1]?.trim();
}

function parseSections(body: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const matches = [...body.matchAll(/^##\s+(.+)$/gm)];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const heading = match[1].trim();
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? body.length;
    sections[heading] = body.slice(start, end).trim();
  }
  if (Object.keys(sections).length === 0) {
    sections.Summary = body.replace(/^#\s+.+$/m, '').trim();
  }
  return sections;
}

function extractMatches(text: string, regex: RegExp): string[] {
  return [...text.matchAll(regex)].map((match) => match[1]);
}

function extractSymbolRefs(sections: Record<string, string>): string[] {
  // Prefer declared symbols in the Key Symbols section; fall back to backtick
  // items across all sections. Never use plain-text heuristics — they produce
  // false positives for domain vocabulary like JWT, CSRF, TODO, Next, etc.
  const text = sections['Key Symbols'] ?? Object.values(sections).join('\n');
  return [...text.matchAll(/`([A-Za-z_$][\w$]{2,})`/g)].map((m) => m[1]);
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function stripCodeFences(text: string): string {
  // Remove triple-backtick code blocks so paths inside code examples are not
  // mistaken for real file references, which would create phantom stale refs.
  return text.replace(/```[\s\S]*?```/g, '');
}
