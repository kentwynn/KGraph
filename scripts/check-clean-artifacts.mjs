#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const forbidden = [
  ".kgraph/",
  ".specify/",
  ".agents/",
  "AGENTS.md",
  "REQUIREMENTS.md",
  "specs/"
];

const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);

const violations = tracked.filter((file) =>
  forbidden.some((pattern) => (pattern.endsWith("/") ? file.startsWith(pattern) : file === pattern))
);

if (violations.length > 0) {
  console.error("Generated/local-only artifacts are tracked and must be removed:");
  for (const file of violations) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log("No generated/local-only artifacts are tracked.");
