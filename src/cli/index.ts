#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { registerInitCommand } from "./commands/init.js";
import { registerScanCommand } from "./commands/scan.js";
import { registerUpdateCommand } from "./commands/update.js";
import { registerContextCommand } from "./commands/context.js";
import { registerIntegrateCommand } from "./commands/integrate.js";

export function createProgram(): Command {
  const program = new Command();
  program
    .name("kgraph")
    .description("Persistent repo intelligence for AI coding assistants")
    .version("0.1.1");

  registerInitCommand(program);
  registerScanCommand(program);
  registerUpdateCommand(program);
  registerContextCommand(program);
  registerIntegrateCommand(program);
  return program;
}

if (isCliEntrypoint()) {
  await createProgram().parseAsync(process.argv);
}

function isCliEntrypoint(): boolean {
  if (!process.argv[1]) {
    return false;
  }

  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return import.meta.url === `file://${process.argv[1]}`;
  }
}
