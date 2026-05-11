import { readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathExists } from '../storage/kgraph-paths.js';
import type { IntegrationConfig, IntegrationName } from '../types/config.js';

export interface InitIntegrationRecommendation {
  name: IntegrationName;
  reason: string;
}

interface MachineDetectionContext {
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
  platform?: NodeJS.Platform;
  exists?: (targetPath: string) => Promise<boolean>;
  readDir?: (targetPath: string) => Promise<string[]>;
  localAppData?: string;
}

export async function detectMachineIntegrationRecommendations(
  context: MachineDetectionContext = {},
): Promise<InitIntegrationRecommendation[]> {
  const env = context.env ?? process.env;
  if (env.KGRAPH_DISABLE_MACHINE_DETECTION === '1') {
    return [];
  }

  const recommendations: InitIntegrationRecommendation[] = [];
  if (
    (await hasVsCodeExtension(
      ['github.copilot-', 'github.copilot-chat-'],
      context,
    )) ||
    (await hasVsCodeBundledCopilot(context))
  ) {
    recommendations.push({
      name: 'copilot',
      reason: 'VS Code Copilot detected',
    });
  }
  if (await hasExecutable('codex', context)) {
    recommendations.push({
      name: 'codex',
      reason: 'codex executable detected on PATH',
    });
  }
  if (await hasExecutable('claude', context)) {
    recommendations.push({
      name: 'claude-code',
      reason: 'claude executable detected on PATH',
    });
  }
  if (await hasExecutable('gemini', context)) {
    recommendations.push({
      name: 'gemini',
      reason: 'gemini executable detected on PATH',
    });
  }

  return recommendations.sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

export function recommendedIntegrationsForInit(options: {
  configuredIntegrations: Pick<IntegrationConfig, 'name'>[];
  detectedIntegrations: InitIntegrationRecommendation[];
}): InitIntegrationRecommendation[] {
  const configured = new Set(
    options.configuredIntegrations.map((item) => item.name),
  );
  return options.detectedIntegrations.filter(
    (item) => !configured.has(item.name),
  );
}

export function integrationSetupCommand(
  recommendations: InitIntegrationRecommendation[],
): string | undefined {
  if (recommendations.length === 0) {
    return undefined;
  }
  return `kgraph integrate add ${recommendations.map((item) => item.name).join(' ')}`;
}

async function hasVsCodeExtension(
  prefixes: string[],
  context: MachineDetectionContext,
): Promise<boolean> {
  const exists = context.exists ?? pathExists;
  const readDir = context.readDir ?? defaultReadDir;
  const homeDir = context.homeDir ?? os.homedir();
  const candidates = [
    path.join(homeDir, '.vscode', 'extensions'),
    path.join(homeDir, '.vscode-insiders', 'extensions'),
  ];

  for (const candidate of candidates) {
    if (!(await exists(candidate))) {
      continue;
    }
    const entries = await readDir(candidate);
    if (
      entries.some((entry) =>
        prefixes.some((prefix) => entry.toLowerCase().startsWith(prefix)),
      )
    ) {
      return true;
    }
  }

  return false;
}

async function hasVsCodeBundledCopilot(
  context: MachineDetectionContext,
): Promise<boolean> {
  const exists = context.exists ?? pathExists;
  const readDir = context.readDir ?? defaultReadDir;
  const platform = context.platform ?? process.platform;
  const env = context.env ?? process.env;

  const dirs = await resolveVsCodeBundledExtensionDirs(
    platform,
    env,
    context.localAppData,
    exists,
    readDir,
  );
  for (const dir of dirs) {
    if (await exists(path.join(dir, 'copilot'))) {
      return true;
    }
  }

  return false;
}

async function resolveVsCodeBundledExtensionDirs(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
  overrideLocalAppData: string | undefined,
  exists: (targetPath: string) => Promise<boolean>,
  readDir: (targetPath: string) => Promise<string[]>,
): Promise<string[]> {
  const dirs: string[] = [];

  if (platform === 'win32') {
    const localAppData = overrideLocalAppData ?? env.LOCALAPPDATA ?? '';
    if (localAppData) {
      const vsCodeRoot = path.join(
        localAppData,
        'Programs',
        'Microsoft VS Code',
      );
      if (await exists(vsCodeRoot)) {
        const entries = await readDir(vsCodeRoot);
        for (const entry of entries) {
          dirs.push(
            path.join(vsCodeRoot, entry, 'resources', 'app', 'extensions'),
          );
        }
      }
    }
  } else if (platform === 'darwin') {
    dirs.push(
      '/Applications/Visual Studio Code.app/Contents/Resources/app/extensions',
    );
    dirs.push(
      '/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/extensions',
    );
  } else {
    dirs.push('/usr/share/code/resources/app/extensions');
    dirs.push('/usr/lib/code/resources/app/extensions');
  }

  return dirs;
}

async function hasExecutable(
  commandName: string,
  context: MachineDetectionContext,
): Promise<boolean> {
  const env = context.env ?? process.env;
  const exists = context.exists ?? pathExists;
  const platform = context.platform ?? process.platform;
  const pathValue = env.PATH ?? '';
  const directories = pathValue
    .split(path.delimiter)
    .map((item) => item.trim())
    .filter(Boolean);
  if (directories.length === 0) {
    return false;
  }

  const candidates =
    platform === 'win32'
      ? buildWindowsExecutableCandidates(commandName, env.PATHEXT)
      : [commandName];

  for (const directory of directories) {
    for (const candidate of candidates) {
      if (await exists(path.join(directory, candidate))) {
        return true;
      }
    }
  }

  return false;
}

function buildWindowsExecutableCandidates(
  commandName: string,
  pathExt: string | undefined,
): string[] {
  const extensions = (pathExt ?? '.EXE;.CMD;.BAT;.COM')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean);
  return [
    commandName,
    ...extensions.map((extension) => `${commandName}${extension}`),
  ];
}

async function defaultReadDir(targetPath: string): Promise<string[]> {
  return readdir(targetPath);
}
