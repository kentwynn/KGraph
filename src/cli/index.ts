#!/usr/bin/env node
import { Command } from "commander";
import { registerInitCommand } from "./commands/init.js";
import { registerScanCommand } from "./commands/scan.js";
import { registerUpdateCommand } from "./commands/update.js";
import { registerContextCommand } from "./commands/context.js";

export function createProgram(): Command {
  const program = new Command();
  program
    .name("kgraph")
    .description("Persistent repo intelligence for AI coding assistants")
    .version("0.1.0");

  registerInitCommand(program);
  registerScanCommand(program);
  registerUpdateCommand(program);
  registerContextCommand(program);
  return program;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await createProgram().parseAsync(process.argv);
}
