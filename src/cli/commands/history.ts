import { Chalk } from 'chalk';
import type { Command } from 'commander';
import { execFile } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { rankByFields } from '../../context/ranking.js';
import { assertWorkspace, pathExists } from '../../storage/kgraph-paths.js';
import { KGraphError, runCommand } from '../errors.js';

const execFileAsync = promisify(execFile);

export interface HistoryEntry {
  timestamp: Date;
  filename: string;
  title: string;
  summary?: string;
  text?: string;
  author?: string;
}

export function registerHistoryCommand(program: Command): void {
  program
    .command('history [query...]')
    .description('Show a timeline of processed cognition sessions')
    .option('--last <n>', 'Show only the last N entries')
    .option('--json', 'Print JSON output')
    .action(
      (queryParts: string[] = [], options: { last?: string; json?: boolean }) =>
        runCommand(async () => {
          const workspace = await assertWorkspace(process.cwd());
          const entries = await readHistoryEntries(
            workspace.processedInteractionsPath,
            workspace.rootPath,
            workspace.cognitionPath,
          );
          const query = queryParts.join(' ').trim();

          const limit =
            options.last !== undefined ? parseInt(options.last, 10) : 0;
          if (options.last !== undefined && (isNaN(limit) || limit < 1)) {
            throw new KGraphError('--last must be a positive integer.');
          }
          const matched = query
            ? rankByFields(query, entries, [
                { name: 'title', value: (entry) => entry.title },
                { name: 'summary', value: (entry) => entry.summary },
                { name: 'content', value: (entry) => entry.text },
                { name: 'filename', value: (entry) => entry.filename },
              ]).map((entry) => entry.item)
            : entries;
          const shown = limit > 0 ? matched.slice(-limit) : matched;

          if (options.json) {
            console.log(
              JSON.stringify(
                shown.map((e) => ({
                  timestamp: e.timestamp.toISOString(),
                  filename: e.filename,
                  title: e.title,
                  ...(e.summary !== undefined ? { summary: e.summary } : {}),
                  ...(e.author !== undefined ? { author: e.author } : {}),
                })),
                null,
                2,
              ),
            );
          } else {
            console.log(renderHistory(shown, undefined, query));
          }
        }),
    );
}

export async function readHistoryEntries(
  processedPath: string,
  rootPath: string,
  cognitionPath?: string,
): Promise<HistoryEntry[]> {
  const entries: HistoryEntry[] = [];

  // Read inbox-processed interactions (raw notes archived from inbox by `kgraph update`)
  if (await pathExists(processedPath)) {
    const dirents = await readdir(processedPath, { withFileTypes: true });
    const filenames = dirents
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => e.name)
      .sort();

    for (const filename of filenames) {
      const timestamp = parseTimestampFromFilename(filename);
      if (!timestamp) continue;

      const filePath = path.join(processedPath, filename);
      const content = await readFile(filePath, 'utf8');
      const title = content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? filename;
      const summary = content
        .match(/^## Summary\s+([\s\S]*?)(?:\n## |\n# |$)/m)?.[1]
        ?.trim();
      const relPath = path.relative(rootPath, filePath);
      const author = await getGitAuthor(rootPath, relPath);

      entries.push({
        timestamp,
        filename,
        title,
        summary,
        text: content,
        author,
      });
    }
  }

  // Also include conclude/session-conclude notes from the cognition store.
  // These bypass the inbox → update pipeline so they never land in interactions/processed/,
  // but they are still durable knowledge events that belong in the history timeline.
  if (cognitionPath && (await pathExists(cognitionPath))) {
    const dirents = await readdir(cognitionPath, { withFileTypes: true });
    const filenames = dirents
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => e.name)
      .sort();

    for (const filename of filenames) {
      // inbox-source notes are already represented via interactions/processed/
      const filePath = path.join(cognitionPath, filename);
      const content = await readFile(filePath, 'utf8');
      const source = content.match(/^Source:\s*(.+)$/m)?.[1]?.trim();
      if (source === 'inbox') continue;

      const timestamp = parseTimestampFromFilename(filename);
      if (!timestamp) continue;

      const title = content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? filename;
      const summary = content
        .match(/^## Summary\s+([\s\S]*?)(?:\n## |\n# |$)/m)?.[1]
        ?.trim();
      const relPath = path.relative(rootPath, filePath);
      const author = await getGitAuthor(rootPath, relPath);

      entries.push({
        timestamp,
        filename,
        title,
        summary,
        text: content,
        author,
      });
    }
  }

  return entries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

/**
 * Parses the UTC timestamp embedded in a processed interaction filename.
 * Filename format: 2026-05-09T09-36-06-247Z-slug.md
 * (colons and dot replaced by dashes when written to disk)
 */
export function parseTimestampFromFilename(filename: string): Date | undefined {
  const match = filename.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z-/,
  );
  if (!match) return undefined;
  const iso = `${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? undefined : d;
}

export function renderHistory(
  entries: HistoryEntry[],
  useColor = supportsColor(),
  query = '',
): string {
  const chalk = new Chalk({ level: useColor ? 3 : 0 });

  if (entries.length === 0) {
    return (
      '\n' +
      chalk.dim(
        '  No cognition history found. Capture knowledge with `kgraph conclude` or write notes to .kgraph/inbox/ and run `kgraph update`.',
      ) +
      '\n'
    );
  }

  const header = `  ${chalk.bold('KGraph History')}  ${chalk.dim(`· ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}${query ? ` matching "${query}"` : ''}`)}`;
  const lines: string[] = ['', header, ''];

  const titleWidth = Math.max(...entries.map((e) => e.title.length));

  for (const entry of entries) {
    const when = chalk.dim(
      `${formatDate(entry.timestamp)}  ${formatTime(entry.timestamp)}`,
    );
    const title = chalk.bold(entry.title.padEnd(titleWidth));
    const who =
      entry.author !== undefined
        ? chalk.cyan(`by ${entry.author}`)
        : chalk.dim('(uncommitted)');
    lines.push(`  ${when}   ${title}  ${who}`);
    if (entry.summary) {
      lines.push(`  ${chalk.dim(entry.summary.split('\n')[0])}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

async function getGitAuthor(
  rootPath: string,
  relFilePath: string,
): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['log', '--format=%an', '-1', '--', relFilePath],
      { cwd: rootPath, timeout: 3000 },
    );
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

function formatDate(d: Date): string {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${months[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, ' ')}, ${d.getUTCFullYear()}`;
}

function formatTime(d: Date): string {
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function supportsColor(): boolean {
  return Boolean(process.stdout.isTTY) && process.env.NO_COLOR === undefined;
}
