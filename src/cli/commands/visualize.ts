import type { Command } from 'commander';
import { exec } from 'node:child_process';
import { createServer } from 'node:http';
import { loadConfig } from '../../config/config.js';
import { refreshKnowledgeAtomStatuses } from '../../knowledge/atom-store.js';
import { assertWorkspace } from '../../storage/kgraph-paths.js';
import { mapsExist, readMaps } from '../../storage/map-store.js';
import { buildGraph } from '../../visualization/graph-builder.js';
import { renderHtml } from '../../visualization/html-template.js';
import { KGraphError, runCommand } from '../errors.js';

export function registerVisualizeCommand(program: Command): void {
  program
    .command('visualize')
    .description(
      'Start a local server and open the interactive dependency graph in browser',
    )
    .option('--port <port>', 'Port to listen on', '4242')
    .option('--no-open', 'Print URL without opening browser')
    .action((options: { port: string; open: boolean }) =>
      runCommand(async () => {
        const port = parseInt(options.port, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          throw new KGraphError(
            'Invalid port. Use a value between 1 and 65535.',
          );
        }

        const workspace = await assertWorkspace(process.cwd());
        if (!(await mapsExist(workspace))) {
          throw new KGraphError(
            'KGraph maps are missing. Run `kgraph scan` first.',
          );
        }

        const maps = await readMaps(workspace);
        const { atoms } = await refreshKnowledgeAtomStatuses(workspace, {
          fileMap: maps.fileMap,
          symbolMap: maps.symbolMap,
        });

        await loadConfig(workspace); // ensure workspace is valid
        const graphData = buildGraph(
          maps.fileMap,
          maps.symbolMap,
          maps.dependencyMap,
          maps.relationshipMap,
          atoms,
        );
        const html = renderHtml(graphData, workspace.rootPath);

        await serveGraph(html, port, options.open);
      }),
    );
}

async function serveGraph(
  html: string,
  port: number,
  autoOpen: boolean,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(
          new KGraphError(
            `Port ${port} is already in use. Try --port <number>.`,
          ),
        );
      } else {
        reject(err);
      }
    });

    server.listen(port, '127.0.0.1', () => {
      const url = `http://localhost:${port}`;
      console.log(`\nKGraph visualization at ${url}\n`);
      console.log('Press Ctrl+C to stop.');
      if (autoOpen) {
        openBrowser(url);
      }
    });

    process.on('SIGINT', () => {
      server.close(() => {
        console.log('\nVisualization server stopped.');
        resolve();
        process.exit(0);
      });
    });
  });
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === 'darwin'
      ? `open "${url}"`
      : process.platform === 'win32'
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd);
}
