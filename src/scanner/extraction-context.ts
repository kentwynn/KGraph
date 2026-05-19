import type {
  CodeSymbol,
  Dependency,
  Relationship,
} from '../types/maps.js';
import type { SymbolExtractionResult } from './ts-symbol-extractor.js';

export class ExtractionContext {
  readonly symbols: CodeSymbol[] = [];
  readonly dependencies: Dependency[] = [];
  readonly relationships: Relationship[] = [];
  readonly warnings: string[] = [];

  constructor(private readonly filePath: string) {}

  addSymbol(options: {
    name: string;
    kind: CodeSymbol['kind'];
    startLine: number;
    endLine?: number;
    exported?: boolean;
    parentName?: string;
  }): CodeSymbol {
    const id = [
      this.filePath,
      options.kind,
      options.parentName,
      options.name,
      options.startLine,
      options.endLine ?? options.startLine,
    ]
      .filter(Boolean)
      .join('#');
    const symbol: CodeSymbol = {
      id,
      name: options.name,
      kind: options.kind,
      filePath: this.filePath,
      startLine: options.startLine,
      endLine: options.endLine ?? options.startLine,
      exported: options.exported ?? false,
      parentName: options.parentName,
    };
    this.symbols.push(symbol);
    this.relationships.push({
      sourceType: 'file',
      sourceId: this.filePath,
      targetType: 'symbol',
      targetId: id,
      relationshipType: 'contains',
      confidence: 'high',
    });
    return symbol;
  }

  addDependency(
    specifier: string,
    kind: Dependency['kind'] = specifier.startsWith('.') ? 'local' : 'package',
    confidence: Relationship['confidence'] = 'high',
  ): void {
    this.dependencies.push({ fromFile: this.filePath, specifier, kind });
    this.relationships.push({
      sourceType: 'file',
      sourceId: this.filePath,
      targetType: kind === 'local' ? 'file' : 'package',
      targetId: specifier,
      relationshipType: 'import',
      confidence,
    });
  }

  addSymbolContains(parent: CodeSymbol, child: CodeSymbol): void {
    this.relationships.push({
      sourceType: 'symbol',
      sourceId: parent.id,
      targetType: 'symbol',
      targetId: child.id,
      relationshipType: 'symbol-contains',
      confidence: 'high',
    });
  }

  addWarning(message: string): void {
    this.warnings.push(message);
  }

  toResult(): SymbolExtractionResult {
    return {
      symbols: this.symbols,
      dependencies: this.dependencies,
      relationships: this.relationships,
      warnings: this.warnings,
    };
  }
}

export function emptyExtractionResult(): SymbolExtractionResult {
  return { symbols: [], dependencies: [], relationships: [], warnings: [] };
}
