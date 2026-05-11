import type { CodeSymbol, Relationship, RepositoryFile } from './maps.js';

export type ReferenceStatus = 'current' | 'stale' | 'unresolved' | 'mixed';

export interface ParsedCognitionNote {
  title: string;
  domain?: string;
  tags: string[];
  summary?: string;
  sections: Record<string, string>;
  relatedFiles: string[];
  relatedSymbols: string[];
  warnings: string[];
}

export interface CognitionNote extends ParsedCognitionNote {
  id: string;
  sourceInboxPath: string;
  processedPath: string;
  createdAt: string;
  referencesStatus: ReferenceStatus;
}

export interface DomainRecord {
  name: string;
  description?: string;
  pathHints: string[];
  tags: string[];
  files: string[];
  symbols: string[];
  cognitionNotes: string[];
}

export interface RankedItem<T> {
  item: T;
  score: number;
  reasons: string[];
}

export interface ContextResponse {
  query: string;
  matchedDomains: RankedItem<DomainRecord>[];
  relevantFiles: RankedItem<RepositoryFile>[];
  relevantSymbols: RankedItem<CodeSymbol>[];
  relevantCognition: RankedItem<CognitionNote>[];
  relationships: Relationship[];
  relationshipExplanations?: Array<{
    relationship: Relationship;
    reasons: string[];
  }>;
  nearbySymbols?: CodeSymbol[];
  nearbySymbolExplanations?: Array<{
    symbol: CodeSymbol;
    reasons: string[];
  }>;
  staleReferences: string[];
  warnings: string[];
}
