import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { KGraphError } from '../cli/errors.js';
import { getIntegrationAdapter } from '../integrations/integration-registry.js';
import { pathExists } from '../storage/kgraph-paths.js';
import type { KGraphWorkspace } from '../types/config.js';
import type { FileMap } from '../types/maps.js';
import type {
  SessionAgent,
  SessionCaptureSource,
  SessionEvent,
  SessionEventType,
  SessionLedgerEntry,
  SessionReport,
  SessionState,
} from '../types/session.js';
import { estimateTokens } from './token-estimator.js';

const EMPTY_STATE: SessionState = {
  active: {},
  events: [],
  updatedAt: '',
};

export function assertSessionAgent(value: string): SessionAgent {
  return getIntegrationAdapter(value).name;
}

export async function readSessionState(
  workspace: KGraphWorkspace,
): Promise<SessionState> {
  const filePath = currentPath(workspace);
  if (!(await pathExists(filePath))) {
    return { ...EMPTY_STATE, active: {}, events: [] };
  }
  return JSON.parse(await readFile(filePath, 'utf8')) as SessionState;
}

export async function resetSession(workspace: KGraphWorkspace): Promise<void> {
  await rm(currentPath(workspace), { force: true });
}

export async function readSessionLedger(
  workspace: KGraphWorkspace,
): Promise<SessionLedgerEntry[]> {
  const filePath = ledgerPath(workspace);
  if (!(await pathExists(filePath))) {
    return [];
  }
  return JSON.parse(await readFile(filePath, 'utf8')) as SessionLedgerEntry[];
}

export async function recordSessionEvent(
  workspace: KGraphWorkspace,
  input: {
    agent: SessionAgent;
    type: SessionEventType;
    path?: string;
    captureSource: SessionCaptureSource;
    fileMap?: FileMap;
  },
): Promise<SessionEvent> {
  const now = new Date().toISOString();
  const state = await readSessionState(workspace);

  if (input.type === 'end' && !state.active[input.agent]) {
    throw new KGraphError(`No active session for agent "${input.agent}".`);
  }

  // Auto-close any open session for this agent before starting a new one so
  // the ledger entry is never silently lost on repeated start calls.
  if (input.type === 'start' && state.active[input.agent]) {
    await appendLedgerEntry(
      workspace,
      summarizeAgentSession(input.agent, state, now),
    );
    delete state.active[input.agent];
  }

  const active = state.active[input.agent] ?? {
    agent: input.agent,
    sessionId: `${input.agent}-${now.replace(/[:.]/g, '-')}`,
    startedAt: now,
    lastEventAt: now,
  };

  const normalizedPath = input.path ? normalizeRepoPath(input.path) : undefined;
  const tokenEstimate =
    normalizedPath && (input.type === 'read' || input.type === 'write')
      ? await estimatePathTokens(workspace, normalizedPath, input.fileMap)
      : undefined;
  const repeated =
    input.type === 'read' && normalizedPath
      ? state.events.some(
          (event) =>
            event.agent === input.agent &&
            event.type === 'read' &&
            event.path === normalizedPath,
        )
      : undefined;

  const event: SessionEvent = {
    id: `${now}-${state.events.length + 1}`,
    agent: input.agent,
    type: input.type,
    ...(normalizedPath ? { path: normalizedPath } : {}),
    ...(tokenEstimate !== undefined ? { tokenEstimate } : {}),
    ...(repeated !== undefined ? { repeated } : {}),
    captureSource: input.captureSource,
    timestamp: now,
  };

  if (input.type === 'start') {
    state.active[input.agent] = active;
  } else if (!state.active[input.agent]) {
    state.active[input.agent] = active;
  }
  state.active[input.agent].lastEventAt = now;
  state.events.push(event);
  state.updatedAt = now;

  if (input.type === 'end') {
    await appendLedgerEntry(
      workspace,
      summarizeAgentSession(input.agent, state, now),
    );
    delete state.active[input.agent];
  }

  await writeSessionState(workspace, state);
  return event;
}

export async function buildSessionReport(
  workspace: KGraphWorkspace,
): Promise<SessionReport> {
  const [state, ledger] = await Promise.all([
    readSessionState(workspace),
    readSessionLedger(workspace),
  ]);
  const readEvents = state.events.filter((event) => event.type === 'read');
  const writeEvents = state.events.filter((event) => event.type === 'write');
  const repeatedReads = readEvents.filter((event) => event.repeated);
  return {
    activeAgents: Object.values(state.active),
    readCount: readEvents.length,
    writeCount: writeEvents.length,
    repeatedReadCount: repeatedReads.length,
    estimatedReadTokens: sumTokens(readEvents),
    estimatedRepeatedReadTokens: sumTokens(repeatedReads),
    topRepeatedReads: topRepeatedReads(readEvents),
    recentEvents: state.events.slice(-10),
    ledger: ledger.slice(-10),
  };
}

async function estimatePathTokens(
  workspace: KGraphWorkspace,
  repoPath: string,
  fileMap?: FileMap,
): Promise<number | undefined> {
  const mapped = fileMap?.files.find((file) => file.path === repoPath);
  if (mapped?.tokenEstimate !== undefined) {
    return mapped.tokenEstimate;
  }
  const fullPath = path.join(workspace.rootPath, repoPath);
  try {
    const info = await stat(fullPath);
    if (!info.isFile()) {
      return undefined;
    }
    const content = await readFile(fullPath, 'utf8');
    return estimateTokens(content, repoPath);
  } catch {
    return undefined;
  }
}

async function writeSessionState(
  workspace: KGraphWorkspace,
  state: SessionState,
): Promise<void> {
  await mkdir(workspace.sessionsPath, { recursive: true });
  await writeFile(
    currentPath(workspace),
    `${JSON.stringify(state, null, 2)}\n`,
    'utf8',
  );
}

async function appendLedgerEntry(
  workspace: KGraphWorkspace,
  entry: SessionLedgerEntry,
): Promise<void> {
  const ledger = await readSessionLedger(workspace);
  ledger.push(entry);
  await mkdir(workspace.sessionsPath, { recursive: true });
  await writeFile(
    ledgerPath(workspace),
    `${JSON.stringify(ledger, null, 2)}\n`,
    'utf8',
  );
}

function summarizeAgentSession(
  agent: SessionAgent,
  state: SessionState,
  endedAt: string,
): SessionLedgerEntry {
  const active = state.active[agent];
  if (!active) {
    throw new KGraphError(`No active session for agent "${agent}".`);
  }
  const events = state.events.filter(
    (event) => event.agent === agent && event.timestamp >= active.startedAt,
  );
  const reads = events.filter((event) => event.type === 'read');
  const repeatedReads = reads.filter((event) => event.repeated);
  return {
    sessionId: active.sessionId,
    agent,
    startedAt: active.startedAt,
    endedAt,
    readCount: reads.length,
    writeCount: events.filter((event) => event.type === 'write').length,
    repeatedReadCount: repeatedReads.length,
    estimatedReadTokens: sumTokens(reads),
    estimatedRepeatedReadTokens: sumTokens(repeatedReads),
  };
}

function topRepeatedReads(
  events: SessionEvent[],
): Array<{ path: string; count: number; estimatedTokens: number }> {
  const byPath = new Map<
    string,
    { path: string; count: number; estimatedTokens: number }
  >();
  for (const event of events) {
    if (!event.path) continue;
    const current = byPath.get(event.path) ?? {
      path: event.path,
      count: 0,
      estimatedTokens: 0,
    };
    current.count += 1;
    current.estimatedTokens += event.tokenEstimate ?? 0;
    byPath.set(event.path, current);
  }
  return [...byPath.values()]
    .filter((item) => item.count > 1)
    .sort((left, right) => right.estimatedTokens - left.estimatedTokens)
    .slice(0, 5);
}

function sumTokens(events: SessionEvent[]): number {
  return events.reduce((total, event) => total + (event.tokenEstimate ?? 0), 0);
}

function normalizeRepoPath(value: string): string {
  return value.split(path.sep).join('/').replace(/^\.\//, '');
}

function currentPath(workspace: KGraphWorkspace): string {
  return path.join(workspace.sessionsPath, 'current.json');
}

function ledgerPath(workspace: KGraphWorkspace): string {
  return path.join(workspace.sessionsPath, 'ledger.json');
}
