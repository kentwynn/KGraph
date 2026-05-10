import type { Command } from 'commander';
import { analyzeAudit, type AuditResponse } from '../../context/audit.js';
import { assertWorkspace } from '../../storage/kgraph-paths.js';
import { mapsExist, readMaps } from '../../storage/map-store.js';
import { KGraphError, runCommand } from '../errors.js';

export function registerAuditCommand(program: Command): void {
  program
    .command('audit')
    .description('Surface security-sensitive files and symbols by category')
    .option('--json', 'Print JSON output')
    .action((options: { json?: boolean }) =>
      runCommand(async () => {
        const workspace = await assertWorkspace(process.cwd());
        if (!(await mapsExist(workspace))) {
          throw new KGraphError('KGraph maps are missing. Run `kgraph scan` first.');
        }
        const maps = await readMaps(workspace);
        const response = analyzeAudit(maps);
        console.log(options.json ? JSON.stringify(response, null, 2) : renderAuditMarkdown(response));
      }),
    );
}

export function renderAuditMarkdown(response: AuditResponse): string {
  const lines: string[] = ['# KGraph Audit', ''];

  if (response.categories.length === 0) {
    lines.push('No security-sensitive patterns found in the current maps.', '');
    lines.push('Run `kgraph scan` to refresh maps if the repo has changed.');
    return lines.join('\n');
  }

  for (const category of response.categories) {
    lines.push(`## ${category.name}`);
    lines.push(category.description, '');
    for (const finding of category.findings) {
      const symbolSuffix =
        finding.matchedSymbols.length > 0
          ? ` — ${finding.matchedSymbols.join(', ')}`
          : '';
      lines.push(`- ${finding.filePath}${symbolSuffix}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push(
    `Flagged: ${response.totalFlaggedFiles} files, ${response.totalFlaggedSymbols} symbols across ${response.categories.length} categories`,
  );
  lines.push('Run `kgraph impact "<symbol>"` to trace any finding deeper.');
  return lines.join('\n');
}
