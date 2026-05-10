import type { Command } from 'commander';
import {
  assertSessionAgent,
  buildSessionReport,
  recordSessionEvent,
  resetSession,
} from '../../session/session-store.js';
import type { SessionCaptureSource } from '../../types/session.js';
import { assertWorkspace } from '../../storage/kgraph-paths.js';
import { readMaps } from '../../storage/map-store.js';
import { KGraphError, runCommand } from '../errors.js';

interface SessionOptions {
  agent?: string;
  source?: SessionCaptureSource;
  json?: boolean;
}

export function registerSessionCommand(program: Command): void {
  const session = program
    .command('session')
    .description('Track agent read/write session activity and token estimates')
    .option('--json', 'Print JSON output')
    .action((options: SessionOptions) =>
      runCommand(async () => {
        const workspace = await assertWorkspace(process.cwd());
        const report = await buildSessionReport(workspace);
        console.log(options.json ? JSON.stringify(report, null, 2) : renderSessionReport(report));
      }),
    );

  session
    .command('start')
    .requiredOption('--agent <name>', 'KGraph integration agent name')
    .option('--source <source>', 'automatic, agent-reported, or manual', 'manual')
    .action((options: SessionOptions) =>
      runCommand(async () => {
        const workspace = await assertWorkspace(process.cwd());
        const event = await recordSessionEvent(workspace, {
          agent: requireAgent(options.agent),
          type: 'start',
          captureSource: normalizeSource(options.source),
        });
        console.log(`KGraph session started for ${event.agent}.`);
      }),
    );

  session
    .command('read <path>')
    .requiredOption('--agent <name>', 'KGraph integration agent name')
    .option('--source <source>', 'automatic, agent-reported, or manual', 'manual')
    .action((filePath: string, options: SessionOptions) =>
      runCommand(async () => {
        const workspace = await assertWorkspace(process.cwd());
        const maps = await readMaps(workspace);
        const event = await recordSessionEvent(workspace, {
          agent: requireAgent(options.agent),
          type: 'read',
          path: filePath,
          captureSource: normalizeSource(options.source),
          fileMap: maps.fileMap,
        });
        console.log(
          `KGraph recorded read: ${event.path}${event.repeated ? ' (repeated)' : ''}${event.tokenEstimate !== undefined ? ` ~${event.tokenEstimate} tokens` : ''}.`,
        );
      }),
    );

  session
    .command('write <path>')
    .requiredOption('--agent <name>', 'KGraph integration agent name')
    .option('--source <source>', 'automatic, agent-reported, or manual', 'manual')
    .action((filePath: string, options: SessionOptions) =>
      runCommand(async () => {
        const workspace = await assertWorkspace(process.cwd());
        const maps = await readMaps(workspace);
        const event = await recordSessionEvent(workspace, {
          agent: requireAgent(options.agent),
          type: 'write',
          path: filePath,
          captureSource: normalizeSource(options.source),
          fileMap: maps.fileMap,
        });
        console.log(`KGraph recorded write: ${event.path}${event.tokenEstimate !== undefined ? ` ~${event.tokenEstimate} tokens` : ''}.`);
      }),
    );

  session
    .command('end')
    .requiredOption('--agent <name>', 'KGraph integration agent name')
    .option('--source <source>', 'automatic, agent-reported, or manual', 'manual')
    .action((options: SessionOptions) =>
      runCommand(async () => {
        const workspace = await assertWorkspace(process.cwd());
        const event = await recordSessionEvent(workspace, {
          agent: requireAgent(options.agent),
          type: 'end',
          captureSource: normalizeSource(options.source),
        });
        console.log(`KGraph session ended for ${event.agent}.`);
      }),
    );

  session
    .command('reset')
    .description('Clear the current session tracker')
    .action(() =>
      runCommand(async () => {
        const workspace = await assertWorkspace(process.cwd());
        await resetSession(workspace);
        console.log('KGraph current session reset.');
      }),
    );
}

export function renderSessionReport(report: Awaited<ReturnType<typeof buildSessionReport>>): string {
  const lines = ['', 'KGraph Session', ''];
  lines.push(`Active agents: ${report.activeAgents.length === 0 ? 'none' : report.activeAgents.map((agent) => agent.agent).join(', ')}`);
  lines.push(`Reads: ${report.readCount}`);
  lines.push(`Writes: ${report.writeCount}`);
  lines.push(`Repeated reads: ${report.repeatedReadCount}`);
  lines.push(`Estimated read tokens: ${report.estimatedReadTokens}`);
  lines.push(`Estimated repeated-read tokens: ${report.estimatedRepeatedReadTokens}`);
  lines.push('', 'Top Repeated Reads');
  lines.push(...formatList(report.topRepeatedReads.map((item) => `- ${item.path} read ${item.count} times (~${item.estimatedTokens} tokens)`)));
  lines.push('', 'Recent Events');
  lines.push(...formatList(report.recentEvents.map((event) => `- ${event.agent} ${event.type}${event.path ? ` ${event.path}` : ''} [${event.captureSource}]`)));
  lines.push('', 'Recent Ledger');
  lines.push(...formatList(report.ledger.map((entry) => `- ${entry.agent} ${entry.readCount} reads, ${entry.writeCount} writes, ${entry.repeatedReadCount} repeated`)));
  return lines.join('\n');
}

function requireAgent(value: string | undefined) {
  if (!value) {
    throw new KGraphError('--agent is required.');
  }
  return assertSessionAgent(value);
}

function normalizeSource(value: string | undefined): SessionCaptureSource {
  if (value === 'automatic' || value === 'agent-reported' || value === 'manual') {
    return value;
  }
  throw new KGraphError('--source must be automatic, agent-reported, or manual.');
}

function formatList(items: string[]): string[] {
  return items.length > 0 ? items : ['- None'];
}
