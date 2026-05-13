import type { Command } from 'commander';
import { readKnowledgeAtoms } from '../../knowledge/atom-store.js';
import { assertWorkspace } from '../../storage/kgraph-paths.js';
import { KGraphError, runCommand } from '../errors.js';

export function registerBlameCommand(program: Command): void {
  program
    .command('blame <atomId>')
    .description('Show who or what created a knowledge atom and why it exists')
    .option('--json', 'Print JSON output')
    .action((atomId: string, options: { json?: boolean }) =>
      runCommand(async () => {
        const workspace = await assertWorkspace(process.cwd());
        const atom = (await readKnowledgeAtoms(workspace)).find(
          (candidate) => candidate.id === atomId,
        );
        if (!atom) throw new KGraphError(`Knowledge atom not found: ${atomId}`);
        const result = {
          id: atom.id,
          topic: atom.topic,
          claim: atom.claim,
          provenance: atom.provenance,
          evidenceRefs: atom.evidenceRefs,
          lifecycle: atom.lifecycle,
        };
        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }
        console.log(`# ${atom.topic}`);
        console.log('');
        console.log(`ID: ${atom.id}`);
        console.log(`Claim: ${atom.claim}`);
        console.log(`Source: ${atom.provenance.sourceCommand}`);
        if (atom.provenance.agent) console.log(`Agent: ${atom.provenance.agent}`);
        if (atom.provenance.sessionId) {
          console.log(`Session: ${atom.provenance.sessionId}`);
        }
        if (atom.provenance.commit) console.log(`Commit: ${atom.provenance.commit}`);
        console.log(`Created: ${atom.provenance.createdAt}`);
        if (atom.provenance.updatedAt) console.log(`Updated: ${atom.provenance.updatedAt}`);
        console.log('');
        console.log('Evidence:');
        for (const ref of atom.evidenceRefs) {
          console.log(`- ${JSON.stringify(ref)}`);
        }
        if (atom.lifecycle.supersededBy || atom.lifecycle.supersedes.length > 0) {
          console.log('');
          console.log('Lifecycle:');
          console.log(JSON.stringify(atom.lifecycle, null, 2));
        }
      }),
    );
}
