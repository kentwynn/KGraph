import { createProgram } from '../cli/index.js';
import { KGraphError } from '../cli/errors.js';
import { concludeTopic } from '../cognition/conclusion.js';
import { normalizeConfidence, normalizeKind } from '../cli/commands/conclude.js';
import { loadConfig } from '../config/config.js';
import { buildContextPack } from '../context/context-pack.js';
import { queryContext } from '../context/context-query.js';
import { analyzeImpact } from '../context/impact.js';
import {
  atomToCognitionNote,
  refreshKnowledgeAtomStatuses,
} from '../knowledge/atom-store.js';
import {
  assertSessionAgent,
  recordSessionEvent,
} from '../session/session-store.js';
import { listInboxNotes } from '../storage/cognition-store.js';
import { assertWorkspace } from '../storage/kgraph-paths.js';
import { mapsExist, readMaps } from '../storage/map-store.js';

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface ToolDefinition {
  name: string;
  description: string;
  mutability: 'read-only' | 'repo-write' | 'destructive';
  inputSchema: JsonValue;
  handler: (args: Record<string, unknown>) => Promise<ToolResult>;
}

interface ToolResult {
  text: string;
  structuredContent?: JsonValue;
  isError?: boolean;
}

interface McpServerOptions {
  rootPath?: string;
  stdin?: NodeJS.ReadableStream;
  stdout?: NodeJS.WritableStream;
}

export async function runMcpServer(
  options: McpServerOptions = {},
): Promise<void> {
  const server = new KGraphMcpServer(options.rootPath ?? process.cwd());
  await server.run(options.stdin ?? process.stdin, options.stdout ?? process.stdout);
}

class KGraphMcpServer {
  private readonly tools: ToolDefinition[];

  constructor(private readonly defaultRootPath: string) {
    this.tools = createTools(defaultRootPath);
  }

  async run(
    stdin: NodeJS.ReadableStream,
    stdout: NodeJS.WritableStream,
  ): Promise<void> {
    let buffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    const pending: Promise<void>[] = [];
    let queue = Promise.resolve();

    stdin.on('data', (chunk: Buffer | string) => {
      buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
      const parsed = parseMessages(buffer);
      buffer = parsed.remaining;
      for (const raw of parsed.messages) {
        queue = queue.then(() => this.handleRawMessage(raw, stdout));
        pending.push(queue);
      }
    });

    await new Promise<void>((resolve) => stdin.on('end', () => resolve()));
    await Promise.all(pending);
  }

  private async handleRawMessage(
    raw: string,
    stdout: NodeJS.WritableStream,
  ): Promise<void> {
    let request: JsonRpcRequest;
    try {
      request = JSON.parse(raw) as JsonRpcRequest;
    } catch {
      writeMessage(stdout, {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' },
      });
      return;
    }

    if (request.id === undefined) {
      return;
    }

    try {
      const result = await this.dispatch(request);
      writeMessage(stdout, { jsonrpc: '2.0', id: request.id, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeMessage(stdout, {
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32000, message },
      });
    }
  }

  private async dispatch(request: JsonRpcRequest): Promise<JsonValue> {
    if (request.method === 'initialize') {
      return {
        protocolVersion: '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'kgraph', version: '0.1.0' },
      };
    }

    if (request.method === 'ping') {
      return {};
    }

    if (request.method === 'tools/list') {
      return {
        tools: this.tools.map((tool) => ({
          name: tool.name,
          description: `${tool.description} Mutability: ${tool.mutability}.`,
          inputSchema: tool.inputSchema,
        })),
      };
    }

    if (request.method === 'tools/call') {
      const name = stringParam(request.params, 'name');
      const args = objectParam(request.params, 'arguments', {});
      const tool = this.tools.find((candidate) => candidate.name === name);
      if (!tool) {
        throw new KGraphError(`Unknown MCP tool "${name}".`);
      }
      const result = await tool.handler(args);
      return {
        content: [{ type: 'text', text: result.text }],
        structuredContent: result.structuredContent ?? {},
        isError: result.isError ?? false,
      };
    }

    throw new KGraphError(`Unsupported MCP method "${request.method}".`);
  }
}

function createTools(defaultRootPath: string): ToolDefinition[] {
  const command = commandTool(defaultRootPath);
  const commandBacked = (
    name: string,
    description: string,
    mutability: ToolDefinition['mutability'],
    buildArgs: (args: Record<string, unknown>) => string[],
    inputSchema: JsonValue = schema({}),
  ): ToolDefinition => ({
    name,
    description,
    mutability,
    inputSchema,
    handler: async (args) => command.handler({ ...args, args: buildArgs(args) }),
  });

  return [
    orchestrateTool(defaultRootPath),
    contextPackTool(defaultRootPath),
    impactTool(defaultRootPath),
    captureTool(defaultRootPath),
    healthTool(defaultRootPath),
    command,
    commandBacked('kgraph_scan', 'Refresh deterministic file, symbol, import, and relationship maps.', 'repo-write', (args) => [
      'scan',
      ...(booleanParam(args, 'verbose') ? ['--verbose'] : []),
    ]),
    commandBacked('kgraph_update', 'Process Markdown cognition notes from .kgraph/inbox.', 'repo-write', (args) => [
      'update',
      ...(booleanParam(args, 'dryRun') ? ['--dry-run'] : []),
    ]),
    commandBacked('kgraph_context', 'Return compact repo context for a query.', 'read-only', (args) => [
      'context',
      requiredString(args, 'query'),
      '--json',
    ], schema({ query: { type: 'string' } }, ['query'])),
    commandBacked('kgraph_pack', 'Build a budget-aware context pack.', 'read-only', (args) => [
      'pack',
      requiredString(args, 'task'),
      '--budget',
      String(numberParam(args, 'budget', 8000)),
      '--json',
      ...agentArgs(args),
    ], schema({ task: { type: 'string' }, budget: { type: 'number' }, agent: { type: 'string' } }, ['task'])),
    commandBacked('kgraph_history', 'Show processed cognition session history.', 'read-only', (args) => [
      'history',
      ...optionalWords(args, 'query'),
      ...numberOption(args, 'last', '--last'),
      '--json',
    ]),
    commandBacked('kgraph_stale', 'Show stale or needs-review knowledge atoms.', 'read-only', () => [
      'stale',
      '--json',
    ]),
    commandBacked('kgraph_blame', 'Show provenance and evidence for a knowledge atom.', 'read-only', (args) => [
      'blame',
      requiredString(args, 'atomId'),
      '--json',
    ], schema({ atomId: { type: 'string' } }, ['atomId'])),
    commandBacked('kgraph_doctor', 'Check KGraph workspace health.', 'read-only', (args) => [
      'doctor',
      ...(booleanParam(args, 'quality') ? ['--quality'] : []),
    ]),
    commandBacked('kgraph_repair', 'Clean noisy stale references from knowledge atoms.', 'repo-write', (args) => [
      'repair',
      ...(booleanParam(args, 'dryRun', true) ? ['--dry-run'] : []),
    ]),
    commandBacked('kgraph_compact', 'Merge duplicate cognition and archive low-value stale entries.', 'repo-write', (args) => [
      'compact',
      ...(booleanParam(args, 'dryRun', true) ? ['--dry-run'] : []),
      '--json',
    ]),
    commandBacked('kgraph_knowledge_list', 'List canonical knowledge atoms.', 'read-only', (args) => [
      'knowledge',
      'list',
      ...stringOption(args, 'type', '--type'),
      ...stringOption(args, 'topic', '--topic'),
      ...(booleanParam(args, 'includeArchived') ? ['--include-archived'] : []),
      '--json',
    ]),
    commandBacked('kgraph_knowledge_get', 'Get one canonical knowledge atom.', 'read-only', (args) => [
      'knowledge',
      'get',
      requiredString(args, 'atomId'),
      '--json',
    ], schema({ atomId: { type: 'string' } }, ['atomId'])),
    commandBacked('kgraph_knowledge_archive', 'Archive one knowledge atom.', 'repo-write', (args) => [
      'knowledge',
      'archive',
      requiredString(args, 'atomId'),
      '--json',
    ], schema({ atomId: { type: 'string' } }, ['atomId'])),
    commandBacked('kgraph_knowledge_supersede', 'Mark one atom as superseded by another.', 'repo-write', (args) => [
      'knowledge',
      'supersede',
      requiredString(args, 'oldId'),
      requiredString(args, 'newId'),
      '--json',
    ], schema({ oldId: { type: 'string' }, newId: { type: 'string' } }, ['oldId', 'newId'])),
    commandBacked('kgraph_session_report', 'Report agent read/write activity and token estimates.', 'read-only', () => [
      'session',
      '--json',
    ]),
    commandBacked('kgraph_session_start', 'Start lightweight session tracking for an agent.', 'repo-write', (args) => [
      'session',
      'start',
      ...requiredAgentArgs(args),
      ...sourceArgs(args),
    ]),
    commandBacked('kgraph_session_read', 'Record an agent file read.', 'repo-write', (args) => [
      'session',
      'read',
      requiredString(args, 'path'),
      ...requiredAgentArgs(args),
      ...sourceArgs(args),
    ]),
    commandBacked('kgraph_session_write', 'Record an agent file write.', 'repo-write', (args) => [
      'session',
      'write',
      requiredString(args, 'path'),
      ...requiredAgentArgs(args),
      ...sourceArgs(args),
    ]),
    commandBacked('kgraph_session_end', 'End session tracking for an agent.', 'repo-write', (args) => [
      'session',
      'end',
      ...requiredAgentArgs(args),
      ...(booleanParam(args, 'conclude') ? ['--conclude'] : []),
      ...stringOption(args, 'topic', '--topic'),
      ...stringOption(args, 'note', '--note'),
      ...stringOption(args, 'confidence', '--confidence'),
      ...sourceArgs(args),
    ]),
    commandBacked('kgraph_session_reset', 'Clear current session tracking.', 'destructive', () => [
      'session',
      'reset',
    ]),
    commandBacked('kgraph_integrate_list', 'List configured AI tool integrations.', 'read-only', () => [
      'integrate',
      'list',
    ]),
    commandBacked('kgraph_integrate_add', 'Add AI tool integrations.', 'repo-write', (args) => [
      'integrate',
      'add',
      ...stringArray(args, 'names'),
      ...stringOption(args, 'mode', '--mode'),
    ]),
    commandBacked('kgraph_integrate_set', 'Set AI tool integration modes.', 'repo-write', (args) => [
      'integrate',
      'set',
      ...stringArray(args, 'names'),
      ...stringOption(args, 'mode', '--mode'),
    ]),
    commandBacked('kgraph_integrate_remove', 'Remove AI tool integrations.', 'destructive', (args) => [
      'integrate',
      'remove',
      ...stringArray(args, 'names'),
    ]),
    commandBacked('kgraph_init', 'Initialize a .kgraph workspace.', 'repo-write', (args) => [
      'init',
      ...stringOption(args, 'integration', '--integration'),
      ...stringOption(args, 'integrations', '--integrations'),
      ...(booleanParam(args, 'yes') ? ['--yes'] : []),
    ]),
    commandBacked('kgraph_uninstall', 'Preview or remove KGraph from this repository.', 'destructive', (args) => [
      'uninstall',
      ...(booleanParam(args, 'yes') ? ['--yes'] : []),
      ...(booleanParam(args, 'keepIntegrations') ? ['--keep-integrations'] : []),
      ...(booleanParam(args, 'memory') ? ['--memory'] : []),
    ]),
    commandBacked('kgraph_visualize', 'Return visualization command output or local URL guidance.', 'read-only', (args) => [
      'visualize',
      '--no-open',
      ...numberOption(args, 'port', '--port'),
    ]),
  ];
}

function commandTool(defaultRootPath: string): ToolDefinition {
  return {
    name: 'kgraph_command',
    description:
      'Compatibility wrapper for the exact KGraph CLI surface. Prefer typed kgraph_* MCP tools when possible.',
    mutability: 'repo-write',
    inputSchema: schema(
      {
        args: { type: 'array', items: { type: 'string' } },
        rootPath: { type: 'string' },
      },
      ['args'],
    ),
    handler: async (args) => {
      const commandArgs = stringArray(args, 'args');
      const result = await runCliInProcess(
        stringParam(args, 'rootPath', defaultRootPath),
        commandArgs,
      );
      const parsed = parseJsonOrUndefined(result.stdout);
      const structuredContent: Record<string, JsonValue> = {
        args: commandArgs,
        exitCode: result.code,
        stdout: result.stdout,
        stderr: result.stderr,
      };
      if (parsed !== undefined) {
        structuredContent.parsed = parsed;
      }
      return {
        text: summarizeCommand(commandArgs, result),
        structuredContent,
        isError: result.code !== 0,
      };
    },
  };
}

function orchestrateTool(defaultRootPath: string): ToolDefinition {
  return {
    name: 'kgraph_orchestrate',
    description:
      'Smart root workflow: refresh maps, process inbox notes, optionally return topic context, run final checks, or capture durable knowledge.',
    mutability: 'repo-write',
    inputSchema: schema({
      topic: { type: 'string' },
      final: { type: 'boolean' },
      capture: { type: 'string' },
      captureType: { type: 'string' },
      confidence: { type: 'string' },
      domain: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      files: { type: 'array', items: { type: 'string' } },
      symbols: { type: 'array', items: { type: 'string' } },
      agent: { type: 'string' },
      rootPath: { type: 'string' },
    }),
    handler: async (args) => {
      const cliArgs = [
        ...optionalWords(args, 'topic'),
        ...(booleanParam(args, 'final') ? ['--final'] : []),
        ...stringOption(args, 'capture', '--capture'),
        ...stringOption(args, 'captureType', '--capture-type'),
        ...stringOption(args, 'confidence', '--capture-confidence'),
        ...stringOption(args, 'domain', '--capture-domain'),
        ...repeatOption(args, 'tags', '--capture-tag'),
        ...repeatOption(args, 'files', '--capture-file'),
        ...repeatOption(args, 'symbols', '--capture-symbol'),
        ...agentArgs(args),
      ];
      const result = await runCliInProcess(
        stringParam(args, 'rootPath', defaultRootPath),
        cliArgs,
      );
      return {
        text: summarizeCommand(cliArgs, result),
        structuredContent: {
          args: cliArgs,
          exitCode: result.code,
          stdout: result.stdout,
          stderr: result.stderr,
        },
        isError: result.code !== 0,
      };
    },
  };
}

function contextPackTool(defaultRootPath: string): ToolDefinition {
  return {
    name: 'kgraph_context_pack',
    description:
      'Build a structured budget-aware ContextPack directly from KGraph internals.',
    mutability: 'read-only',
    inputSchema: schema(
      {
        task: { type: 'string' },
        budget: { type: 'number' },
        agent: { type: 'string' },
        rootPath: { type: 'string' },
      },
      ['task'],
    ),
    handler: async (args) => {
      const task = requiredString(args, 'task');
      const budget = numberParam(args, 'budget', 8000);
      const workspace = await assertWorkspace(
        stringParam(args, 'rootPath', defaultRootPath),
      );
      if (!(await mapsExist(workspace))) {
        throw new KGraphError('KGraph maps are missing. Run `kgraph scan` first.');
      }
      const [config, maps] = await Promise.all([
        loadConfig(workspace),
        readMaps(workspace),
      ]);
      const response = await queryContext(workspace, config, maps, task);
      const pack = buildContextPack(response, budget, workspace.rootPath);
      const pendingInboxFiles = await listInboxNotes(workspace);
      if (pendingInboxFiles.length > 0) {
        pack.pendingInbox = {
          count: pendingInboxFiles.length,
          files: pendingInboxFiles,
        };
      }
      const agent = stringParam(args, 'agent', '');
      if (agent) {
        await recordSessionEvent(workspace, {
          agent: assertSessionAgent(agent),
          type: 'context',
          captureSource: 'automatic',
          packUsedTokens: pack.usedTokens,
          packOmittedTokens: pack.omitted.reduce(
            (sum, item) => sum + item.tokenEstimate,
            0,
          ),
        });
      }
      return {
        text: `KGraph context pack for "${task}": ${pack.items.length} item(s), ${pack.usedTokens}/${pack.budget} tokens.`,
        structuredContent: pack as unknown as JsonValue,
      };
    },
  };
}

function impactTool(defaultRootPath: string): ToolDefinition {
  return {
    name: 'kgraph_impact',
    description: 'Analyze practical impact for a file, symbol, or topic.',
    mutability: 'read-only',
    inputSchema: schema({ query: { type: 'string' }, rootPath: { type: 'string' } }, ['query']),
    handler: async (args) => {
      const query = requiredString(args, 'query');
      const workspace = await assertWorkspace(
        stringParam(args, 'rootPath', defaultRootPath),
      );
      if (!(await mapsExist(workspace))) {
        throw new KGraphError('KGraph maps are missing. Run `kgraph scan` first.');
      }
      const [config, maps] = await Promise.all([
        loadConfig(workspace),
        readMaps(workspace),
      ]);
      const { atoms } = await refreshKnowledgeAtomStatuses(workspace, {
        fileMap: maps.fileMap,
        symbolMap: maps.symbolMap,
      });
      const response = analyzeImpact(
        query,
        maps,
        atoms.filter((atom) => atom.status !== 'archived').map(atomToCognitionNote),
        config.maxContextItems,
      );
      return {
        text: `KGraph impact for "${query}": ${response.files.length} file(s), ${response.symbols.length} symbol(s), ${response.risk.length} risk signal(s).`,
        structuredContent: response as unknown as JsonValue,
      };
    },
  };
}

function captureTool(defaultRootPath: string): ToolDefinition {
  return {
    name: 'kgraph_capture',
    description: 'Store a durable typed engineering conclusion.',
    mutability: 'repo-write',
    inputSchema: schema(
      {
        topic: { type: 'string' },
        note: { type: 'string' },
        type: { type: 'string' },
        confidence: { type: 'string' },
        domain: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        files: { type: 'array', items: { type: 'string' } },
        symbols: { type: 'array', items: { type: 'string' } },
        rootPath: { type: 'string' },
      },
      ['topic'],
    ),
    handler: async (args) => {
      const workspace = await assertWorkspace(
        stringParam(args, 'rootPath', defaultRootPath),
      );
      const note = await concludeTopic(workspace, {
        topic: requiredString(args, 'topic'),
        body: stringParam(args, 'note', undefined),
        kind: normalizeKind(stringParam(args, 'type', 'summary')),
        confidence: normalizeConfidence(stringParam(args, 'confidence', 'medium')),
        domain: stringParam(args, 'domain', undefined),
        tags: stringArray(args, 'tags', []),
        relatedFiles: stringArray(args, 'files', []),
        relatedSymbols: stringArray(args, 'symbols', []),
        source: 'conclude',
      });
      return {
        text: `Stored ${note.kind} cognition: ${note.title}`,
        structuredContent: note as unknown as JsonValue,
      };
    },
  };
}

function healthTool(defaultRootPath: string): ToolDefinition {
  return {
    name: 'kgraph_health',
    description: 'Check KGraph workspace health and optional cognition quality.',
    mutability: 'read-only',
    inputSchema: schema({ quality: { type: 'boolean' }, rootPath: { type: 'string' } }),
    handler: async (args) => {
      const result = await runCliInProcess(
        stringParam(args, 'rootPath', defaultRootPath),
        ['doctor', ...(booleanParam(args, 'quality') ? ['--quality'] : [])],
      );
      return {
        text: summarizeCommand(['doctor'], result),
        structuredContent: {
          exitCode: result.code,
          stdout: result.stdout,
          stderr: result.stderr,
          checks: parseDoctorChecks(result.stdout),
        },
        isError: result.code !== 0,
      };
    },
  };
}

async function runCliInProcess(
  rootPath: string,
  args: string[],
): Promise<{ stdout: string; stderr: string; code: number }> {
  const originalCwd = process.cwd();
  const originalStdout = process.stdout.write;
  const originalStderr = process.stderr.write;
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalExitCode = process.exitCode;
  let stdout = '';
  let stderr = '';

  process.chdir(rootPath);
  process.exitCode = undefined;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdout += chunk.toString();
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderr += chunk.toString();
    return true;
  }) as typeof process.stderr.write;
  console.log = (...items: unknown[]) => {
    stdout += `${items.map(String).join(' ')}\n`;
  };
  console.error = (...items: unknown[]) => {
    stderr += `${items.map(String).join(' ')}\n`;
  };

  try {
    await createProgram().parseAsync(['node', 'kgraph', ...args], {
      from: 'node',
    });
    return {
      stdout,
      stderr,
      code: typeof process.exitCode === 'number' ? process.exitCode : 0,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { stdout, stderr: `${stderr}${message}\n`, code: 1 };
  } finally {
    process.stdout.write = originalStdout;
    process.stderr.write = originalStderr;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exitCode = originalExitCode;
    process.chdir(originalCwd);
  }
}

function parseMessages(buffer: Buffer<ArrayBufferLike>): {
  messages: string[];
  remaining: Buffer<ArrayBufferLike>;
} {
  const messages: string[] = [];
  let remaining = buffer;

  while (remaining.length > 0) {
    const headerEnd = remaining.indexOf('\r\n\r\n');
    if (headerEnd === -1) {
      const newline = remaining.indexOf('\n');
      if (newline === -1) break;
      const line = remaining.subarray(0, newline).toString('utf8').trim();
      if (!line) {
        remaining = remaining.subarray(newline + 1);
        continue;
      }
      messages.push(line);
      remaining = remaining.subarray(newline + 1);
      continue;
    }

    const header = remaining.subarray(0, headerEnd).toString('utf8');
    const match = /content-length:\s*(\d+)/i.exec(header);
    if (!match) {
      remaining = remaining.subarray(headerEnd + 4);
      continue;
    }
    const length = Number.parseInt(match[1], 10);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + length;
    if (remaining.length < bodyEnd) break;
    messages.push(remaining.subarray(bodyStart, bodyEnd).toString('utf8'));
    remaining = remaining.subarray(bodyEnd);
  }

  return { messages, remaining };
}

function writeMessage(stdout: NodeJS.WritableStream, message: JsonValue): void {
  stdout.write(`${JSON.stringify(message)}\n`);
}

function schema(
  properties: Record<string, JsonValue>,
  required: string[] = [],
): JsonValue {
  return {
    type: 'object',
    properties: {
      rootPath: {
        type: 'string',
        description: 'Repository root path. Defaults to the MCP server cwd.',
      },
      ...properties,
    },
    required,
    additionalProperties: false,
  };
}

function objectParam(
  params: Record<string, unknown> | undefined,
  key: string,
  fallback: Record<string, unknown>,
): Record<string, unknown> {
  const value = params?.[key];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : fallback;
}

function stringParam(
  args: Record<string, unknown> | undefined,
  key: string,
  fallback = '',
): string {
  const value = args?.[key];
  return typeof value === 'string' ? value : fallback;
}

function requiredString(args: Record<string, unknown>, key: string): string {
  const value = stringParam(args, key).trim();
  if (!value) throw new KGraphError(`${key} is required.`);
  return value;
}

function booleanParam(
  args: Record<string, unknown>,
  key: string,
  fallback = false,
): boolean {
  const value = args[key];
  return typeof value === 'boolean' ? value : fallback;
}

function numberParam(
  args: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const value = args[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringArray(
  args: Record<string, unknown>,
  key: string,
  fallback: string[] = [],
): string[] {
  const value = args[key];
  if (!Array.isArray(value)) return fallback;
  return value.filter((item): item is string => typeof item === 'string');
}

function stringOption(
  args: Record<string, unknown>,
  key: string,
  flag: string,
): string[] {
  const value = stringParam(args, key);
  return value ? [flag, value] : [];
}

function numberOption(
  args: Record<string, unknown>,
  key: string,
  flag: string,
): string[] {
  const value = args[key];
  return typeof value === 'number' && Number.isFinite(value)
    ? [flag, String(value)]
    : [];
}

function repeatOption(
  args: Record<string, unknown>,
  key: string,
  flag: string,
): string[] {
  return stringArray(args, key).flatMap((value) => [flag, value]);
}

function optionalWords(args: Record<string, unknown>, key: string): string[] {
  const value = stringParam(args, key);
  return value ? [value] : [];
}

function agentArgs(args: Record<string, unknown>): string[] {
  return stringOption(args, 'agent', '--agent');
}

function requiredAgentArgs(args: Record<string, unknown>): string[] {
  return ['--agent', requiredString(args, 'agent')];
}

function sourceArgs(args: Record<string, unknown>): string[] {
  return stringOption(args, 'source', '--source');
}

function parseJsonOrUndefined(value: string): JsonValue | undefined {
  try {
    return JSON.parse(value) as JsonValue;
  } catch {
    return undefined;
  }
}

function summarizeCommand(
  args: string[],
  result: { stdout: string; stderr: string; code: number },
): string {
  const command = args.length > 0 ? `kgraph ${args.join(' ')}` : 'kgraph';
  const firstLine =
    result.stdout.split('\n').find((line) => line.trim()) ??
    result.stderr.split('\n').find((line) => line.trim()) ??
    'no output';
  return `${command} exited ${result.code}: ${firstLine}`;
}

function parseDoctorChecks(stdout: string): JsonValue {
  return stdout
    .split('\n')
    .map((line) => /^(OK|FAIL)\s+([^:]+):\s*(.*)$/.exec(line))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => ({
      ok: match[1] === 'OK',
      label: match[2].trim(),
      detail: match[3].trim(),
    }));
}
