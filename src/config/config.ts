import { readFile, writeFile } from 'node:fs/promises';
import YAML from 'yaml';
import { KGraphError } from '../cli/errors.js';
import { pathExists } from '../storage/kgraph-paths.js';
import type {
  IntegrationConfig,
  IntegrationMode,
  KGraphConfig,
  KGraphWorkspace,
} from '../types/config.js';

export const DEFAULT_CONFIG: KGraphConfig = {
  include: ['**/*'],
  exclude: [
    '.git',
    'node_modules',
    'dist',
    'build',
    '.next',
    'coverage',
    '.kgraph',
    '.npm-cache',
    '.cache',
    '.turbo',
    '.vite',
    '.nuxt',
    '.output',
    '.vercel',
    '.serverless',
    '.agents',
    '.specify',
    'specs',
    '.cursor',
    '.claude',
    '.windsurf',
    '.clinerules',
    '.github/copilot-instructions.md',
    '.github/prompts',
    'AGENTS.md',
    'CLAUDE.md',
    'GEMINI.md',
    'REQUIREMENTS.md',
    '*.log',
    '*.tgz',
    '.DS_Store',
  ],
  languages: {
    precise: [
      // JavaScript / TypeScript
      '.js',
      '.jsx',
      '.ts',
      '.tsx',
      // Python
      '.py',
      '.pyw',
      '.pyi',
      // Go
      '.go',
      // Rust
      '.rs',
      // Java / Kotlin
      '.java',
      '.kt',
      '.kts',
      // C / C++
      '.c',
      '.h',
      '.cpp',
      '.cc',
      '.cxx',
      '.hpp',
      '.hxx',
      // C#
      '.cs',
    ],
  },
  maxContextItems: 8,
  domainHints: {},
  integrations: [],
};

export async function writeDefaultConfig(
  workspace: KGraphWorkspace,
): Promise<boolean> {
  if (await pathExists(workspace.configPath)) {
    return false;
  }

  await writeFile(workspace.configPath, YAML.stringify(DEFAULT_CONFIG), 'utf8');
  return true;
}

export async function saveConfig(
  workspace: KGraphWorkspace,
  config: KGraphConfig,
): Promise<void> {
  await writeFile(workspace.configPath, YAML.stringify(config), 'utf8');
}

export async function loadConfig(
  workspace: KGraphWorkspace,
): Promise<KGraphConfig> {
  if (!(await pathExists(workspace.configPath))) {
    return DEFAULT_CONFIG;
  }

  try {
    const raw = await readFile(workspace.configPath, 'utf8');
    const parsed = YAML.parse(raw) as Partial<KGraphConfig> | null;
    return normalizeConfig(parsed ?? {});
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new KGraphError(
      `Invalid config at ${workspace.configPath}: ${message}`,
    );
  }
}

export function normalizeConfig(config: Partial<KGraphConfig>): KGraphConfig {
  return {
    include: Array.isArray(config.include)
      ? config.include
      : DEFAULT_CONFIG.include,
    exclude: mergeUnique(
      DEFAULT_CONFIG.exclude,
      Array.isArray(config.exclude) ? config.exclude : [],
    ),
    languages: {
      precise: Array.isArray(config.languages?.precise)
        ? config.languages.precise
        : DEFAULT_CONFIG.languages.precise,
    },
    maxContextItems:
      typeof config.maxContextItems === 'number' && config.maxContextItems > 0
        ? config.maxContextItems
        : DEFAULT_CONFIG.maxContextItems,
    domainHints:
      config.domainHints && typeof config.domainHints === 'object'
        ? config.domainHints
        : {},
    integrations: normalizeIntegrations(config.integrations),
  };
}

function mergeUnique<T>(base: T[], extra: T[]): T[] {
  return [...new Set([...base, ...extra])];
}

function normalizeIntegrations(value: unknown): IntegrationConfig[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const integrations: IntegrationConfig[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const candidate = item as Partial<IntegrationConfig>;
    if (
      typeof candidate.name !== 'string' ||
      typeof candidate.targetPath !== 'string' ||
      seen.has(candidate.name)
    ) {
      continue;
    }
    if (
      ![
        'claude-code',
        'cline',
        'codex',
        'copilot',
        'cursor',
        'gemini',
        'windsurf',
      ].includes(candidate.name)
    ) {
      continue;
    }
    seen.add(candidate.name);
    integrations.push({
      name: candidate.name,
      enabled: candidate.enabled !== false,
      mode: normalizeIntegrationMode(candidate.mode),
      targetPath: candidate.targetPath,
    } as IntegrationConfig);
  }
  return integrations;
}

function normalizeIntegrationMode(value: unknown): IntegrationMode {
  return value === 'smart' || value === 'manual' || value === 'off'
    ? value
    : 'always';
}
