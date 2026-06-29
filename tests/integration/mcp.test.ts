import { Writable, PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { runMcpServer } from '../../src/mcp/server.js';
import {
  cleanupTempRepo,
  createTempRepo,
  runCli,
  writeText,
} from '../fixtures/helpers.js';

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: {
    tools?: Array<{ name: string; description: string }>;
    content?: Array<{ type: string; text: string }>;
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
  };
  error?: { code: number; message: string };
}

describe('kgraph mcp', () => {
  it('lists typed tools for the full KGraph command surface with mutability labels', async () => {
    const repo = await createTempRepo();
    try {
      const responses = await callMcp(repo, [
        { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
        { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
      ]);

      expect(responses[0].result).toMatchObject({
        serverInfo: { name: 'kgraph' },
      });
      const tools = responses[1].result?.tools ?? [];
      const names = tools.map((tool) => tool.name);
      expect(names).toContain('kgraph_orchestrate');
      expect(names).toContain('kgraph_command');
      expect(names).toContain('kgraph_context_pack');
      expect(names).toContain('kgraph_knowledge_supersede');
      expect(names).toContain('kgraph_integrate_remove');
      expect(names).toContain('kgraph_uninstall');
      expect(
        tools.find((tool) => tool.name === 'kgraph_uninstall')?.description,
      ).toContain('Mutability: destructive');
      expect(
        tools.find((tool) => tool.name === 'kgraph_context_pack')?.description,
      ).toContain('Mutability: read-only');
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('runs the compatibility command wrapper in-process with CLI parity', async () => {
    const repo = await createTempRepo();
    try {
      await runCli(repo, ['init']);
      const cli = await runCli(repo, ['doctor']);

      const [response] = await callMcp(repo, [
        {
          jsonrpc: '2.0',
          id: 'doctor',
          method: 'tools/call',
          params: {
            name: 'kgraph_command',
            arguments: { args: ['doctor'] },
          },
        },
      ]);

      expect(response.error).toBeUndefined();
      expect(response.result?.isError).toBe(false);
      expect(response.result?.structuredContent).toMatchObject({
        exitCode: cli.code,
        stdout: cli.stdout,
      });
    } finally {
      await cleanupTempRepo(repo);
    }
  });

  it('supports typed write and read orchestration through capture and context pack tools', async () => {
    const repo = await createTempRepo();
    try {
      await writeText(
        repo,
        'src/auth.ts',
        'export function issueToken(userId: string) { return `token:${userId}`; }\n',
      );
      await runCli(repo, ['init']);

      const responses = await callMcp(repo, [
        {
          jsonrpc: '2.0',
          id: 'capture',
          method: 'tools/call',
          params: {
            name: 'kgraph_capture',
            arguments: {
              topic: 'auth token issuing',
              note: 'issueToken returns a token string keyed by user id.',
              type: 'finding',
              confidence: 'high',
              files: ['src/auth.ts'],
            },
          },
        },
        {
          jsonrpc: '2.0',
          id: 'pack',
          method: 'tools/call',
          params: {
            name: 'kgraph_context_pack',
            arguments: { task: 'auth token', budget: 4000 },
          },
        },
      ]);

      expect(responses[0].result?.isError).toBe(false);
      expect(responses[0].result?.content?.[0]?.text).toContain(
        'Stored finding cognition',
      );
      expect(responses[1].result?.isError).toBe(false);
      expect(responses[1].result?.structuredContent).toMatchObject({
        task: 'auth token',
        budget: 4000,
      });
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});

async function callMcp(
  rootPath: string,
  messages: Array<Record<string, unknown>>,
): Promise<JsonRpcResponse[]> {
  const stdin = new PassThrough();
  const chunks: Buffer[] = [];
  const stdout = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });

  const server = runMcpServer({ rootPath, stdin, stdout });
  for (const message of messages) {
    stdin.write(`${JSON.stringify(message)}\n`);
  }
  stdin.end();
  await server;
  const output = Buffer.concat(chunks).toString('utf8');
  expect(output).not.toContain('Content-Length:');
  return parseJsonLines(output);
}

function parseJsonLines(output: string): JsonRpcResponse[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as JsonRpcResponse);
}
