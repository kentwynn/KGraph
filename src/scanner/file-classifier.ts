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
  const parts = repoPath.split(/[\\/]/);
  return config.exclude.some((pattern) => {
    const normalized = pattern.replace(/\/$/, "");
    return parts.includes(normalized) || repoPath === normalized || repoPath.startsWith(`${normalized}/`);
  });
}

export function detectLanguage(filePath: string): string {
  return LANGUAGE_BY_EXTENSION[path.extname(filePath)] ?? "unknown";
}

export function isPreciseLanguage(filePath: string, config: KGraphConfig): boolean {
  return config.languages.precise.includes(path.extname(filePath));
}
