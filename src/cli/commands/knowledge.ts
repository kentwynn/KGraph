import type { Command } from 'commander';
import {
  atomToCognitionNote,
  readKnowledgeAtoms,
  updateKnowledgeAtom,
  updateKnowledgeAtoms,
} from '../../knowledge/atom-store.js';
import { rebuildDomainRecords } from '../../cognition/domain-records.js';
import { assertWorkspace } from '../../storage/kgraph-paths.js';
import { readMaps } from '../../storage/map-store.js';
import type { KnowledgeAtom, KnowledgeAtomStatus } from '../../types/knowledge.js';
import { KGraphError, runCommand } from '../errors.js';

interface KnowledgeListOptions {
  type?: string;
  topic?: string;
  status?: string;
  json?: boolean;
}

export function registerKnowledgeCommand(program: Command): void {
  const knowledge = program
    .command('knowledge')
    .description('Manage canonical KGraph knowledge atoms');

  knowledge
    .command('list')
    .option('--type <type>', 'Filter by atom type')
    .option('--topic <topic>', 'Filter by topic substring')
    .option('--status <status>', 'Filter by active, stale, needs-review, or archived')
    .option('--json', 'Print JSON output')
    .action((options: KnowledgeListOptions) =>
      runCommand(async () => {
        const workspace = await assertWorkspace(process.cwd());
        const atoms = filterAtoms(await readKnowledgeAtoms(workspace), options);
        if (options.json) {
          console.log(JSON.stringify(atoms, null, 2));
          return;
        }
        console.log('KGraph Knowledge');
        console.log('');
        for (const atom of atoms) {
          console.log(
            `- ${atom.id} [${atom.type}, ${atom.confidence}, ${atom.status}] ${atom.topic}`,
          );
          console.log(`  ${atom.claim}`);
        }
        if (atoms.length === 0) console.log('- None');
      }),
    );

  knowledge
    .command('get <atomId>')
    .option('--json', 'Print JSON output')
    .action((atomId: string, options: { json?: boolean }) =>
      runCommand(async () => {
        const workspace = await assertWorkspace(process.cwd());
        const atom = await requireAtom(workspace, atomId);
        if (options.json) {
          console.log(JSON.stringify(atom, null, 2));
          return;
        }
        console.log(`# ${atom.topic}`);
        console.log('');
        console.log(`ID: ${atom.id}`);
        console.log(`Type: ${atom.type}`);
        console.log(`Confidence: ${atom.confidence}`);
        console.log(`Status: ${atom.status}`);
        console.log(`Claim: ${atom.claim}`);
        if (atom.summary) console.log(`Summary: ${atom.summary}`);
        console.log('');
        console.log('Evidence:');
        for (const ref of atom.evidenceRefs) {
          console.log(`- ${JSON.stringify(ref)}`);
        }
        console.log('');
        console.log('Provenance:');
        console.log(JSON.stringify(atom.provenance, null, 2));
        console.log('');
        console.log('Lifecycle:');
        console.log(JSON.stringify(atom.lifecycle, null, 2));
      }),
    );

  knowledge
    .command('archive <atomId>')
    .option('--json', 'Print JSON output')
    .action((atomId: string, options: { json?: boolean }) =>
      runCommand(async () => {
        const workspace = await assertWorkspace(process.cwd());
        const now = new Date().toISOString();
        const atom = await updateKnowledgeAtom(workspace, atomId, (current) => ({
          ...current,
          status: 'archived',
          provenance: { ...current.provenance, updatedAt: now },
          lifecycle: { ...current.lifecycle, archivedAt: now },
        }));
        await rebuildActiveDomainRecords(workspace);
        console.log(
          options.json
            ? JSON.stringify(atom, null, 2)
            : `Archived knowledge atom: ${atom.id}`,
        );
      }),
    );

  knowledge
    .command('supersede <oldId> <newId>')
    .option('--json', 'Print JSON output')
    .action((oldId: string, newId: string, options: { json?: boolean }) =>
      runCommand(async () => {
        const workspace = await assertWorkspace(process.cwd());
        const now = new Date().toISOString();
        const result = await updateKnowledgeAtoms(workspace, (atoms) => {
          const oldIndex = atoms.findIndex((atom) => atom.id === oldId);
          const newIndex = atoms.findIndex((atom) => atom.id === newId);
          if (oldIndex === -1) {
            throw new KGraphError(`Knowledge atom not found: ${oldId}`);
          }
          if (newIndex === -1) {
            throw new KGraphError(`Knowledge atom not found: ${newId}`);
          }
          const nextAtoms = [...atoms];
          nextAtoms[oldIndex] = {
            ...nextAtoms[oldIndex],
            status: 'archived',
            provenance: { ...nextAtoms[oldIndex].provenance, updatedAt: now },
            lifecycle: {
              ...nextAtoms[oldIndex].lifecycle,
              supersededBy: newId,
              archivedAt: now,
            },
          };
          nextAtoms[newIndex] = {
            ...nextAtoms[newIndex],
            provenance: { ...nextAtoms[newIndex].provenance, updatedAt: now },
            lifecycle: {
              ...nextAtoms[newIndex].lifecycle,
              supersedes: [
                ...new Set([...nextAtoms[newIndex].lifecycle.supersedes, oldId]),
              ],
            },
          };
          return {
            atoms: nextAtoms,
            result: { old: nextAtoms[oldIndex], new: nextAtoms[newIndex] },
          };
        });
        await rebuildActiveDomainRecords(workspace);
        console.log(
          options.json
            ? JSON.stringify(result, null, 2)
            : `Superseded ${oldId} with ${newId}`,
        );
      }),
    );
}

async function rebuildActiveDomainRecords(
  workspace: Awaited<ReturnType<typeof assertWorkspace>>,
): Promise<void> {
  const maps = await readMaps(workspace);
  const activeNotes = (await readKnowledgeAtoms(workspace))
    .filter((atom) => atom.status !== 'archived')
    .map(atomToCognitionNote);
  await rebuildDomainRecords(workspace, activeNotes, {
    files: maps.fileMap.files,
    symbols: maps.symbolMap.symbols,
  });
}

async function requireAtom(
  workspace: Awaited<ReturnType<typeof assertWorkspace>>,
  atomId: string,
): Promise<KnowledgeAtom> {
  const atom = (await readKnowledgeAtoms(workspace)).find(
    (candidate) => candidate.id === atomId,
  );
  if (!atom) throw new KGraphError(`Knowledge atom not found: ${atomId}`);
  return atom;
}

function filterAtoms(
  atoms: KnowledgeAtom[],
  options: KnowledgeListOptions,
): KnowledgeAtom[] {
  return atoms.filter((atom) => {
    if (options.type && atom.type !== options.type) return false;
    if (
      options.status &&
      atom.status !== normalizeStatus(options.status)
    ) {
      return false;
    }
    if (
      options.topic &&
      !atom.topic.toLowerCase().includes(options.topic.toLowerCase())
    ) {
      return false;
    }
    return true;
  });
}

function normalizeStatus(value: string): KnowledgeAtomStatus {
  if (
    value === 'active' ||
    value === 'stale' ||
    value === 'needs-review' ||
    value === 'archived'
  ) {
    return value;
  }
  throw new KGraphError('--status must be active, stale, needs-review, or archived.');
}
