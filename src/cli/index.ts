#!/usr/bin/env node
import { Command } from 'commander';
import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { registerContextCommand } from './commands/context.js';
import { registerDoctorCommand } from './commands/doctor.js';
import { registerExtractorCommand } from './commands/extractor.js';
import { registerHistoryCommand } from './commands/history.js';
import { registerImpactCommand } from './commands/impact.js';
import { registerInitCommand } from './commands/init.js';
import { registerIntegrateCommand } from './commands/integrate.js';
import { registerRepairCommand } from './commands/repair.js';
import { registerScanCommand } from './commands/scan.js';
import { registerSessionCommand } from './commands/session.js';
import { registerUpdateCommand } from './commands/update.js';
import { registerVisualizeCommand } from './commands/visualize.js';
import { runDefaultWorkflow } from './commands/workflow.js';
import { renderRootHelp } from './help.js';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json') as { version: string };

export function createProgram(): Command {
  const program = new Command();
  program
    .name('kgraph')
    .description('Persistent repo intelligence for AI coding assistants')
    .argument(
      '[topic...]',
      'Run the default refresh workflow and optionally return context for a topic',
    )
    .version(version)
    .addHelpText('beforeAll', renderRootHelp())
    .helpOption(false)
    .action(async (topicParts: string[] = []) => {
      await runDefaultWorkflow(topicParts.join(' '));
    });

  program.option('-h, --help', 'Show this help');
  program.hook('preAction', (thisCommand) => {
    if (thisCommand.opts().help) {
      console.log(renderRootHelp());
      process.exitCode = 0;
    }
  });

  registerInitCommand(program);
  registerScanCommand(program);
  registerSessionCommand(program);
  registerUpdateCommand(program);
  registerContextCommand(program);
  registerImpactCommand(program);
  registerExtractorCommand(program);
  registerIntegrateCommand(program);
  registerVisualizeCommand(program);
  registerHistoryCommand(program);
  registerDoctorCommand(program);
  registerRepairCommand(program);
  return program;
}

if (isCliEntrypoint()) {
  const program = createProgram();
  if (process.argv.includes('-h') || process.argv.includes('--help')) {
    console.log(renderRootHelp());
  } else {
    await program.parseAsync(process.argv);
  }
}

function isCliEntrypoint(): boolean {
  if (!process.argv[1]) {
    return false;
  }

  try {
    return (
      realpathSync(fileURLToPath(import.meta.url)) ===
      realpathSync(process.argv[1])
    );
  } catch {
    return import.meta.url === `file://${process.argv[1]}`;
  }
}
