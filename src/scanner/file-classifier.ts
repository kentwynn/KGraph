import path from "node:path";
import type { KGraphConfig } from "../types/config.js";

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ".js": "javascript",
  ".jsx": "javascriptreact",
  ".ts": "typescript",
  ".tsx": "typescriptreact",
  ".json": "json",
  ".md": "markdown",
  ".yaml": "yaml",
  ".yml": "yaml"
};

export function shouldExclude(repoPath: string, config: KGraphConfig): boolean {
  const normalizedPath = normalizeRepoPath(repoPath);
  return config.exclude.some((pattern) => matchesExcludePattern(normalizedPath, pattern));
}

export function buildFastGlobIgnore(exclude: string[]): string[] {
  const patterns = new Set<string>();
  for (const pattern of exclude) {
    const normalized = normalizeRepoPath(pattern).replace(/\/$/, "");
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

export function detectLanguage(filePath: string): string {
  return LANGUAGE_BY_EXTENSION[path.extname(filePath)] ?? "unknown";
}

export function isPreciseLanguage(filePath: string, config: KGraphConfig): boolean {
  return config.languages.precise.includes(path.extname(filePath));
}

function matchesExcludePattern(repoPath: string, pattern: string): boolean {
  const normalized = normalizeRepoPath(pattern).replace(/\/$/, "");
  if (!normalized) {
    return false;
  }

  if (hasGlob(normalized)) {
    return globToRegExp(normalized).test(repoPath) || globToRegExp(`**/${normalized}`).test(repoPath);
  }

  if (repoPath === normalized || repoPath.startsWith(`${normalized}/`)) {
    return true;
  }

  if (!normalized.includes("/")) {
    return repoPath.split("/").includes(normalized);
  }

  return false;
}

function normalizeRepoPath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\/+/, "");
}

function hasGlob(pattern: string): boolean {
  return /[*?[\]{}]/.test(pattern);
}

function globToRegExp(pattern: string): RegExp {
  let source = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const next = pattern[index + 1];

    if (char === "*" && next === "*") {
      source += ".*";
      index += 1;
      continue;
    }

    if (char === "*") {
      source += "[^/]*";
      continue;
    }

    if (char === "?") {
      source += "[^/]";
      continue;
    }

    source += escapeRegExp(char);
  }

  return new RegExp(`^${source}$`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}
