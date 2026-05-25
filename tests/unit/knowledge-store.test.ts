import { describe, expect, it } from 'vitest';
import {
  createKnowledgeAtom,
  readKnowledgeAtoms,
  updateKnowledgeAtoms,
} from '../../src/knowledge/atom-store.js';
import { ensureWorkspace } from '../../src/storage/kgraph-paths.js';
import { cleanupTempRepo, createTempRepo } from '../fixtures/helpers.js';

describe('knowledge atom store', () => {
  it('serializes concurrent atom writes without corrupting atoms.jsonl', async () => {
    const repo = await createTempRepo();
    try {
      const workspace = await ensureWorkspace(repo);

      await Promise.all(
        Array.from({ length: 8 }, (_, index) =>
          createKnowledgeAtom(workspace, {
            type: 'finding',
            topic: `concurrent atom ${index}`,
            claim: `Concurrent atom ${index} is stored safely.`,
            confidence: 'medium',
            sourceCommand: 'conclude',
          }),
        ),
      );

      const atoms = await readKnowledgeAtoms(workspace);
      expect(atoms).toHaveLength(8);
      expect(new Set(atoms.map((atom) => atom.id)).size).toBe(8);

      const first = atoms[0].id;
      const second = atoms[1].id;
      await updateKnowledgeAtoms(workspace, (current) => {
        const next = current.map((atom) => {
          if (atom.id === first) {
            return {
              ...atom,
              status: 'archived' as const,
              lifecycle: { ...atom.lifecycle, supersededBy: second },
            };
          }
          if (atom.id === second) {
            return {
              ...atom,
              lifecycle: {
                ...atom.lifecycle,
                supersedes: [...atom.lifecycle.supersedes, first],
              },
            };
          }
          return atom;
        });
        return { atoms: next, result: undefined };
      });

      const updated = await readKnowledgeAtoms(workspace);
      expect(updated.find((atom) => atom.id === first)?.status).toBe('archived');
      expect(updated.find((atom) => atom.id === second)?.lifecycle.supersedes).toContain(first);
    } finally {
      await cleanupTempRepo(repo);
    }
  });
});
