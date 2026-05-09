import type {
  CodeSymbol,
  Dependency,
  DependencyKind,
  Relationship,
} from '../types/maps.js';
import type { SymbolExtractionResult } from './ts-symbol-extractor.js';

export function extractPythonSymbols(
  sourceText: string,
  filePath: string,
): SymbolExtractionResult {
  const lines = sourceText.split('\n');
  const symbols: CodeSymbol[] = [];
  const dependencies: Dependency[] = [];
  const relationships: Relationship[] = [];
  const warnings: string[] = [];

  // Stack tracks nested class scope: [{name, indent}]
  const classStack: Array<{ name: string; indent: number }> = [];

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
      exported: false,
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const trimmed = line.trimStart();

    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = line.length - trimmed.length;

    // Pop classes we've exited: any class whose indent >= current line's indent
    // (unless this line IS the class that opened at that indent — handled by re-pushing below)
    while (
      classStack.length > 0 &&
      classStack[classStack.length - 1].indent >= indent
    ) {
      classStack.pop();
    }

    // class definition
    const classMatch = trimmed.match(/^class\s+([A-Za-z_]\w*)/);
    if (classMatch) {
      const name = classMatch[1];
      const parent = classStack[classStack.length - 1];
      addSymbol(name, 'class', lineNum, parent?.name);
      classStack.push({ name, indent });
      continue;
    }

    // function / method definition (sync or async)
    const funcMatch = trimmed.match(/^(?:async\s+)?def\s+([A-Za-z_]\w*)/);
    if (funcMatch) {
      const name = funcMatch[1];
      const parent = classStack[classStack.length - 1];
      const kind: CodeSymbol['kind'] =
        parent !== undefined ? 'method' : 'function';
      addSymbol(name, kind, lineNum, parent?.name);
      continue;
    }

    // import module
    const importMatch = trimmed.match(/^import\s+([\w.]+)/);
    if (importMatch) {
      const specifier = importMatch[1];
      dependencies.push({ fromFile: filePath, specifier, kind: 'package' });
      addSymbol(specifier, 'import', lineNum);
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

    // from X import Y
    const fromMatch = trimmed.match(/^from\s+(\S+)\s+import/);
    if (fromMatch) {
      const specifier = fromMatch[1];
      const kind: DependencyKind = specifier.startsWith('.')
        ? 'local'
        : 'package';
      dependencies.push({ fromFile: filePath, specifier, kind });
      relationships.push({
        sourceType: 'file',
        sourceId: filePath,
        targetType: kind === 'local' ? 'file' : 'package',
        targetId: specifier,
        relationshipType: 'import',
        confidence: kind === 'local' ? 'medium' : 'high',
      });
    }
  }

  return { symbols, dependencies, relationships, warnings };
}
