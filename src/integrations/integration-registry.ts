import type { IntegrationName } from '../types/config.js';
import { claudeCodeAdapter } from './adapters/claude-code.js';
import { clineAdapter } from './adapters/cline.js';
import { codexAdapter } from './adapters/codex.js';
import { copilotAdapter } from './adapters/copilot.js';
import { cursorAdapter } from './adapters/cursor.js';
import { geminiAdapter } from './adapters/gemini.js';
import { windsurfAdapter } from './adapters/windsurf.js';

export interface IntegrationAdapter {
  name: IntegrationName;
  label: string;
  targetPath: string;
  instructions: string;
  commandFiles?: IntegrationCommandFile[];
  obsoleteCommandFiles?: string[];
}

export interface IntegrationCommandFile {
  path: string;
  content: string;
}

const ADAPTERS: IntegrationAdapter[] = [
  claudeCodeAdapter,
  clineAdapter,
  codexAdapter,
  copilotAdapter,
  cursorAdapter,
  geminiAdapter,
  windsurfAdapter,
].sort((left, right) => left.name.localeCompare(right.name));

export function listIntegrationAdapters(): IntegrationAdapter[] {
  return ADAPTERS;
}

export function getIntegrationAdapter(name: string): IntegrationAdapter {
  const adapter = ADAPTERS.find((item) => item.name === name);
  if (!adapter) {
    throw new Error(
      `Unsupported integration "${name}". Supported integrations: ${ADAPTERS.map((item) => item.name).join(', ')}`,
    );
  }
  return adapter;
}

export function normalizeIntegrationNames(
  values: string[] | undefined,
): IntegrationName[] {
  if (!values || values.length === 0) {
    return [];
  }

  const names: IntegrationName[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    for (const raw of value.split(/[\s,]+/)) {
      const name = raw.trim();
      if (!name || seen.has(name)) {
        continue;
      }
      const adapter = getIntegrationAdapter(name);
      seen.add(adapter.name);
      names.push(adapter.name);
    }
  }
  return names;
}
