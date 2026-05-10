import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { KGraphWorkspace } from "../types/config.js";
import type { CognitionNote, DomainRecord } from "../types/cognition.js";
import { pathExists } from "./kgraph-paths.js";

export async function listInboxNotes(workspace: KGraphWorkspace): Promise<string[]> {
  if (!(await pathExists(workspace.inboxPath))) {
    return [];
  }

  const entries = await readdir(workspace.inboxPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.join(workspace.inboxPath, entry.name))
    .sort();
}

export async function archiveInboxNote(
  workspace: KGraphWorkspace,
  inboxPath: string,
  timestamp: string
): Promise<string> {
  await mkdir(workspace.processedInteractionsPath, { recursive: true });
  const target = path.join(workspace.processedInteractionsPath, `${timestamp}-${path.basename(inboxPath)}`);
  await rename(inboxPath, target);
  return target;
}

export async function writeCognitionNote(workspace: KGraphWorkspace, note: CognitionNote): Promise<string> {
  await mkdir(workspace.cognitionPath, { recursive: true });
  const filePath = path.join(workspace.cognitionPath, `${note.id}.md`);
  await writeFile(filePath, renderCognitionNote(note), "utf8");
  return filePath;
}

export async function writeDomainRecord(workspace: KGraphWorkspace, domain: DomainRecord): Promise<string> {
  await mkdir(workspace.domainsPath, { recursive: true });
  const filePath = path.join(workspace.domainsPath, `${slugify(domain.name)}.md`);
  const existing = (await pathExists(filePath))
    ? parseEmbeddedJson<DomainRecord>(await readFile(filePath, "utf8"))
    : undefined;
  const merged = existing ? mergeDomainRecords(existing, domain) : domain;
  await writeFile(filePath, renderDomainRecord(merged), "utf8");
  return filePath;
}

export async function readCognitionNotes(workspace: KGraphWorkspace): Promise<CognitionNote[]> {
  if (!(await pathExists(workspace.cognitionPath))) {
    return [];
  }

  const entries = await readdir(workspace.cognitionPath, { withFileTypes: true });
  const notes: CognitionNote[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }
    const filePath = path.join(workspace.cognitionPath, entry.name);
    const raw = await readFile(filePath, "utf8");
    const encoded = parseEmbeddedJson<CognitionNote>(raw);
    if (encoded) {
      notes.push(encoded);
    }
  }
  return notes;
}

export async function readDomainRecords(workspace: KGraphWorkspace): Promise<DomainRecord[]> {
  if (!(await pathExists(workspace.domainsPath))) {
    return [];
  }

  const entries = await readdir(workspace.domainsPath, { withFileTypes: true });
  const domains: DomainRecord[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }
    const raw = await readFile(path.join(workspace.domainsPath, entry.name), "utf8");
    const encoded = parseEmbeddedJson<DomainRecord>(raw);
    if (encoded) {
      domains.push(encoded);
    }
  }
  return domains;
}

function parseEmbeddedJson<T>(raw: string): T | undefined {
  const encoded = raw.match(/```json\n([\s\S]*?)\n```/);
  return encoded ? (JSON.parse(encoded[1]) as T) : undefined;
}

function mergeDomainRecords(existing: DomainRecord, next: DomainRecord): DomainRecord {
  return {
    ...existing,
    ...next,
    description: next.description ?? existing.description,
    pathHints: unique([...existing.pathHints, ...next.pathHints]),
    tags: unique([...existing.tags, ...next.tags]),
    files: unique([...existing.files, ...next.files]),
    symbols: unique([...existing.symbols, ...next.symbols]),
    cognitionNotes: unique([
      ...existing.cognitionNotes,
      ...next.cognitionNotes,
    ]),
  };
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function renderCognitionNote(note: CognitionNote): string {
  const sectionText = Object.entries(note.sections)
    .map(([heading, content]) => `## ${heading}\n\n${content.trim()}`)
    .join("\n\n");
  return `# ${note.title}\n\nStatus: ${note.referencesStatus}\n\n${sectionText}\n\n## KGraph Metadata\n\n\`\`\`json\n${JSON.stringify(note, null, 2)}\n\`\`\`\n`;
}

function renderDomainRecord(domain: DomainRecord): string {
  return `# ${domain.name}\n\n${domain.description ?? ""}\n\n## Files\n\n${domain.files
    .map((file) => `- ${file}`)
    .join("\n")}\n\n## Symbols\n\n${domain.symbols
    .map((symbol) => `- ${symbol}`)
    .join("\n")}\n\n## Cognition Notes\n\n${domain.cognitionNotes
    .map((note) => `- ${note}`)
    .join("\n")}\n\n## KGraph Metadata\n\n\`\`\`json\n${JSON.stringify(domain, null, 2)}\n\`\`\`\n`;
}
