import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { KGraphConfig } from '../types/config.js';

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  // JavaScript / TypeScript
  '.js': 'javascript',
  '.jsx': 'javascriptreact',
  '.ts': 'typescript',
  '.tsx': 'typescriptreact',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  // Python
  '.py': 'python',
  '.pyw': 'python',
  '.pyi': 'python',
  // Go
  '.go': 'go',
  // Rust
  '.rs': 'rust',
  // Java / JVM
  '.java': 'java',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.scala': 'scala',
  '.groovy': 'groovy',
  // C / C++
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  '.hxx': 'cpp',
  // C#
  '.cs': 'csharp',
  // Ruby
  '.rb': 'ruby',
  '.rake': 'ruby',
  // PHP
  '.php': 'php',
  // Swift
  '.swift': 'swift',
  // Shell
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.fish': 'shell',
  // Web
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'sass',
  '.less': 'less',
  '.vue': 'vue',
  '.svelte': 'svelte',
  // Data / Config
  '.json': 'json',
  '.jsonc': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.xml': 'xml',
  '.graphql': 'graphql',
  '.gql': 'graphql',
  // Docs
  '.md': 'markdown',
  '.mdx': 'markdown',
  '.rst': 'restructuredtext',
  '.tex': 'latex',
  // Other
  '.lua': 'lua',
  '.r': 'r',
  '.R': 'r',
  '.dart': 'dart',
  '.ex': 'elixir',
  '.exs': 'elixir',
  '.erl': 'erlang',
  '.hrl': 'erlang',
  '.hs': 'haskell',
  '.clj': 'clojure',
  '.tf': 'terraform',
  '.proto': 'protobuf',
  '.sql': 'sql',
};

export function shouldExclude(repoPath: string, config: KGraphConfig): boolean {
  const normalizedPath = normalizeRepoPath(repoPath);
  return config.exclude.some((pattern) =>
    matchesExcludePattern(normalizedPath, pattern),
  );
}

export function buildFastGlobIgnore(exclude: string[]): string[] {
  const patterns = new Set<string>();
  for (const pattern of exclude) {
    const normalized = normalizeRepoPath(pattern).replace(/\/$/, '');
    if (!normalized) {
      continue;
    }

    if (hasGlob(normalized)) {
      patterns.add(normalized);
      patterns.add(`**/${normalized}`);
      continue;
    }

    patterns.add(normalized);
    patterns.add(`**/${normalized}`);
    patterns.add(`${normalized}/**`);
    patterns.add(`**/${normalized}/**`);
  }
  return [...patterns];
}

export async function readGitignorePatterns(
  rootPath: string,
): Promise<string[]> {
  try {
    const raw = await readFile(path.join(rootPath, '.gitignore'), 'utf8');
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(
        (line) =>
          line.length > 0 && !line.startsWith('#') && !line.startsWith('!'),
      );
  } catch {
    return [];
  }
}

export function detectLanguage(filePath: string): string {
  return LANGUAGE_BY_EXTENSION[path.extname(filePath)] ?? 'unknown';
}

export function isPreciseLanguage(
  filePath: string,
  config: KGraphConfig,
): boolean {
  return config.languages.precise.includes(path.extname(filePath));
}

function matchesExcludePattern(repoPath: string, pattern: string): boolean {
  const normalized = normalizeRepoPath(pattern).replace(/\/$/, '');
  if (!normalized) {
    return false;
  }

  if (hasGlob(normalized)) {
    return (
      globToRegExp(normalized).test(repoPath) ||
      globToRegExp(`**/${normalized}`).test(repoPath)
    );
  }

  if (repoPath === normalized || repoPath.startsWith(`${normalized}/`)) {
    return true;
  }

  if (!normalized.includes('/')) {
    return repoPath.split('/').includes(normalized);
  }

  return false;
}

function normalizeRepoPath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\/+/, '');
}

function hasGlob(pattern: string): boolean {
  return /[*?[\]{}]/.test(pattern);
}

function globToRegExp(pattern: string): RegExp {
  let source = '';
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const next = pattern[index + 1];

    if (char === '*' && next === '*') {
      source += '.*';
      index += 1;
      continue;
    }

    if (char === '*') {
      source += '[^/]*';
      continue;
    }

    if (char === '?') {
      source += '[^/]';
      continue;
    }

    source += escapeRegExp(char);
  }

  return new RegExp(`^${source}$`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}
