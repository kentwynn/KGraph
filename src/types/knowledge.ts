import type { CognitionConfidence, CognitionKind } from './cognition.js';

export type KnowledgeAtomStatus =
  | 'active'
  | 'stale'
  | 'needs-review'
  | 'archived';

export type KnowledgeEvidenceRef =
  | {
      type: 'file';
      path: string;
      startLine?: number;
      endLine?: number;
      contentHash?: string;
    }
  | {
      type: 'symbol';
      name: string;
      filePath?: string;
      symbolId?: string;
      startLine?: number;
      endLine?: number;
    }
  | {
      type: 'git';
      commit?: string;
      path?: string;
    }
  | {
      type: 'session';
      sessionId?: string;
      agent?: string;
    };

export interface KnowledgeScopeRefs {
  files: string[];
  symbols: string[];
  domains: string[];
  packages: string[];
}

export interface KnowledgeProvenance {
  sourceCommand: 'update' | 'conclude' | 'session-conclude' | 'legacy-migration' | 'compact';
  agent?: string;
  sessionId?: string;
  commit?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface KnowledgeLifecycle {
  supersedes: string[];
  supersededBy?: string;
  invalidatedBy?: string[];
  archivedAt?: string;
}

export interface KnowledgeAtom {
  id: string;
  type: CognitionKind;
  topic: string;
  claim: string;
  summary?: string;
  confidence: CognitionConfidence;
  status: KnowledgeAtomStatus;
  evidenceRefs: KnowledgeEvidenceRef[];
  scopeRefs: KnowledgeScopeRefs;
  provenance: KnowledgeProvenance;
  lifecycle: KnowledgeLifecycle;
}

export interface KnowledgeSchema {
  version: number;
  createdAt: string;
  updatedAt: string;
  migrations: Array<{
    id: string;
    appliedAt: string;
  }>;
}

export interface KnowledgeIndexes {
  terms: Record<string, string[]>;
  refs: Record<string, string[]>;
  topics: Record<string, string[]>;
}

export interface KnowledgeValidationIssue {
  code:
    | 'missing-schema'
    | 'old-schema'
    | 'invalid-jsonl'
    | 'broken-file-ref'
    | 'broken-symbol-ref'
    | 'stale-file-hash';
  message: string;
  atomId?: string;
}

export interface ContextPackItem {
  kind: 'file' | 'file-range' | 'symbol' | 'atom' | 'relationship' | 'git-change';
  id: string;
  title: string;
  tokenEstimate: number;
  reasons: string[];
  data: unknown;
}

export interface ContextPack {
  task: string;
  budget: number;
  usedTokens: number;
  items: ContextPackItem[];
  omitted: ContextPackItem[];
  warnings: string[];
}
