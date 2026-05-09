import type { CodeSymbol, Dependency, Relationship } from '../types/maps.js';
import type { SymbolExtractionResult } from './ts-symbol-extractor.js';

export function extractGoSymbols(
  sourceText: string,
  filePath: string,
): SymbolExtractionResult {
  const lines = sourceText.split('\n');
  const symbols: CodeSymbol[] = [];
  const dependencies: Dependency[] = [];
  const relationships: Relationship[] = [];
  const warnings: string[] = [];

  const addSymbol = (
    name: string,
    kind: CodeSymbol['kind'],
    lineNum: number,
    parentName?: string,
  ): void => {
    const id = [filePath, kind, parentName, name, lineNum]
      .filter(Boolean)
      .join('#');
    symbols.push({
      id,
      name,
      kind,
      filePath,
      startLine: lineNum,
      endLine: lineNum,
      exported: /^[A-Z]/.test(name), // Go: exported = starts with uppercase
      parentName,
    });
    relationships.push({
      sourceType: 'file',
      sourceId: filePath,
      targetType: 'symbol',
      targetId: id,
      relationshipType: 'contains',
      confidence: 'high',
    });
  };

  let inImportBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('//')) continue;

    // import block: import ( ... )
    if (trimmed === 'import (') {
      inImportBlock = true;
      continue;
    }
    if (inImportBlock) {
      if (trimmed === ')') {
        inImportBlock = false;
        continue;
      }
      // e.g. "fmt" or aliased: log "log/slog"
      const specMatch = trimmed.match(/"([^"]+)"/);
      if (specMatch) {
        const specifier = specMatch[1];
        dependencies.push({ fromFile: filePath, specifier, kind: 'package' });
        relationships.push({
          sourceType: 'file',
          sourceId: filePath,
          targetType: 'package',
          targetId: specifier,
          relationshipType: 'import',
          confidence: 'high',
        });
      }
      continue;
    }

    // single import: import "fmt"
    const singleImport = trimmed.match(/^import\s+"([^"]+)"/);
    if (singleImport) {
      const specifier = singleImport[1];
      dependencies.push({ fromFile: filePath, specifier, kind: 'package' });
      relationships.push({
        sourceType: 'file',
        sourceId: filePath,
        targetType: 'package',
        targetId: specifier,
        relationshipType: 'import',
        confidence: 'high',
      });
      continue;
    }

    // method with receiver: func (r ReceiverType) MethodName(
    const methodMatch = trimmed.match(
      /^func\s+\(\s*\w+\s+\*?(\w+)\s*\)\s+(\w+)\s*\(/,
    );
    if (methodMatch) {
      addSymbol(methodMatch[2], 'method', lineNum, methodMatch[1]);
      continue;
    }

    // top-level function: func FuncName(
    const funcMatch = trimmed.match(/^func\s+(\w+)\s*\(/);
    if (funcMatch) {
      addSymbol(funcMatch[1], 'function', lineNum);
      continue;
    }

    // type declaration: type Name struct / type Name interface / type Name ...
    const typeMatch = trimmed.match(/^type\s+(\w+)\s+/);
    if (typeMatch) {
      addSymbol(typeMatch[1], 'class', lineNum); // 'class' is closest kind for struct/interface
      continue;
    }
  }

  return { symbols, dependencies, relationships, warnings };
}
