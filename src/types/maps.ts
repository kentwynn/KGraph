export type ScanStatus = "mapped" | "generic" | "failed";
export type DependencyKind = "local" | "package" | "unknown";
export type SymbolKind =
  | "function"
  | "class"
  | "method"
  | "type"
  | "interface"
  | "export"
  | "import";
export type RelationshipType =
  | "import"
  | "contains"
  | "symbol-contains"
  | "calls"
  | "mentions"
  | "belongs-to-domain"
  | "stale-reference"
  | "moved-from";

export interface RepositoryFile {
  id: string;
  path: string;
  extension: string;
  language: string;
  sizeBytes: number;
  modifiedAt?: string;
  contentHash: string;
  scanStatus: ScanStatus;
  warnings: string[];
}

export interface CodeSymbol {
  id: string;
  name: string;
  kind: SymbolKind;
  filePath: string;
  startLine?: number;
  endLine?: number;
  exported: boolean;
  parentName?: string;
}

export interface Dependency {
  fromFile: string;
  specifier: string;
  resolvedFile?: string;
  kind: DependencyKind;
}

export interface Relationship {
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  relationshipType: RelationshipType;
  confidence: "high" | "medium" | "low";
}

export interface FileMap {
  generatedAt: string;
  files: RepositoryFile[];
}

export interface SymbolMap {
  generatedAt: string;
  symbols: CodeSymbol[];
}

export interface DependencyMap {
  generatedAt: string;
  dependencies: Dependency[];
}

export interface RelationshipMap {
  generatedAt: string;
  relationships: Relationship[];
}

export interface ScanResult {
  files: RepositoryFile[];
  symbols: CodeSymbol[];
  dependencies: Dependency[];
  relationships: Relationship[];
  warnings: string[];
}
