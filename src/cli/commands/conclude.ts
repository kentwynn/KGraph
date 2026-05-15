import type { Command } from 'commander';
import { concludeTopic } from '../../cognition/conclusion.js';
import type { CognitionConfidence, CognitionKind } from '../../types/cognition.js';
import { assertWorkspace } from '../../storage/kgraph-paths.js';
import { KGraphError, runCommand } from '../errors.js';

interface ConcludeOptions {
  type?: string;
  confidence?: string;
  domain?: string;
  tag?: string[];
  file?: string[];
  symbol?: string[];
  note?: string;
  json?: boolean;
}

export function registerConcludeCommand(program: Command): void {
  program
    .command('conclude <topic>')
    .description('Store durable typed engineering cognition for this repo')
    .option('--type <type>', 'finding, decision, gotcha, summary, or relationship', 'summary')
    .option('--confidence <level>', 'high, medium, or low', 'medium')
    .option('--domain <name>', 'Domain name for this cognition')
    .option('--tag <tag>', 'Tag to attach; repeatable', collect, [])
    .option('--file <path>', 'Related repo file; repeatable', collect, [])
    .option('--symbol <name>', 'Related symbol; repeatable', collect, [])
    .option('--note <text>', 'Concise durable conclusion text')
    .option('--json', 'Print JSON output')
    .action((topic: string, options: ConcludeOptions) =>
      runCommand(async () => {
        const workspace = await assertWorkspace(process.cwd());
        const note = await concludeTopic(workspace, {
          topic,
          body: options.note,
          kind: normalizeKind(options.type),
          confidence: normalizeConfidence(options.confidence),
          domain: options.domain,
          tags: options.tag ?? [],
          relatedFiles: options.file ?? [],
          relatedSymbols: options.symbol ?? [],
          source: 'conclude',
        });
        if (options.json) {
          console.log(JSON.stringify(note, null, 2));
          return;
        }
        console.log(`Stored ${note.kind} cognition: ${note.title}`);
        console.log(`Confidence: ${note.confidence}`);
        console.log(`Status: ${note.referencesStatus}`);
        for (const warning of note.warnings) {
          console.error(`Warning: ${warning}`);
        }
      }),
    );
}

export function normalizeKind(value: string | undefined): CognitionKind {
  if (
    value === 'finding' ||
    value === 'decision' ||
    value === 'gotcha' ||
    value === 'summary' ||
    value === 'relationship'
  ) {
    return value;
  }
  throw new KGraphError('--type must be finding, decision, gotcha, summary, or relationship.');
}

export function normalizeConfidence(value: string | undefined): CognitionConfidence {
  if (value === 'high' || value === 'medium' || value === 'low') {
    return value;
  }
  throw new KGraphError('--confidence must be high, medium, or low.');
}

function collect(value: string, previous: string[]): string[] {
  previous.push(value);
  return previous;
}
