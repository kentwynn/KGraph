import { readFile, writeFile } from "node:fs/promises";
import YAML from "yaml";
import type { IntegrationConfig, KGraphConfig, KGraphWorkspace } from "../types/config.js";
import { pathExists } from "../storage/kgraph-paths.js";
import { KGraphError } from "../cli/errors.js";

export const DEFAULT_CONFIG: KGraphConfig = {
  include: ["**/*"],
  exclude: [".git", "node_modules", "dist", "build", ".next", "coverage", ".kgraph"],
  languages: {
    precise: [".js", ".jsx", ".ts", ".tsx"]
  },
  maxContextItems: 8,
  domainHints: {},
  integrations: []
};

export async function writeDefaultConfig(workspace: KGraphWorkspace): Promise<boolean> {
  if (await pathExists(workspace.configPath)) {
    return false;
  }

  await writeFile(workspace.configPath, YAML.stringify(DEFAULT_CONFIG), "utf8");
  return true;
}

export async function saveConfig(workspace: KGraphWorkspace, config: KGraphConfig): Promise<void> {
  await writeFile(workspace.configPath, YAML.stringify(config), "utf8");
}

export async function loadConfig(workspace: KGraphWorkspace): Promise<KGraphConfig> {
  if (!(await pathExists(workspace.configPath))) {
    return DEFAULT_CONFIG;
  }

  try {
    const raw = await readFile(workspace.configPath, "utf8");
    const parsed = YAML.parse(raw) as Partial<KGraphConfig> | null;
    return normalizeConfig(parsed ?? {});
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new KGraphError(`Invalid config at ${workspace.configPath}: ${message}`);
  }
}

export function normalizeConfig(config: Partial<KGraphConfig>): KGraphConfig {
  return {
    include: Array.isArray(config.include) ? config.include : DEFAULT_CONFIG.include,
    exclude: Array.isArray(config.exclude) ? config.exclude : DEFAULT_CONFIG.exclude,
    languages: {
      precise: Array.isArray(config.languages?.precise)
        ? config.languages.precise
        : DEFAULT_CONFIG.languages.precise
    },
    maxContextItems:
      typeof config.maxContextItems === "number" && config.maxContextItems > 0
        ? config.maxContextItems
        : DEFAULT_CONFIG.maxContextItems,
    domainHints: config.domainHints && typeof config.domainHints === "object" ? config.domainHints : {},
    integrations: normalizeIntegrations(config.integrations)
  };
}

function normalizeIntegrations(value: unknown): IntegrationConfig[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const integrations: IntegrationConfig[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const candidate = item as Partial<IntegrationConfig>;
    if (
      typeof candidate.name !== "string" ||
      typeof candidate.targetPath !== "string" ||
      seen.has(candidate.name)
    ) {
      continue;
    }
    if (!["claude-code", "codex", "copilot", "cursor"].includes(candidate.name)) {
      continue;
    }
    seen.add(candidate.name);
    integrations.push({
      name: candidate.name,
      enabled: candidate.enabled !== false,
      targetPath: candidate.targetPath
    } as IntegrationConfig);
  }
  return integrations;
}
