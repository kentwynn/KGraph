import type { Command } from 'commander';
import { runMcpServer } from '../../mcp/server.js';

interface McpOptions {
  root?: string;
}

export function registerMcpCommand(program: Command): void {
  program
    .command('mcp')
    .description('Start the local KGraph MCP server over stdio')
    .option('--root <path>', 'Repository root path', process.cwd())
    .action(async (options: McpOptions) => {
      await runMcpServer({ rootPath: options.root ?? process.cwd() });
    });
}
