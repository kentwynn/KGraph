import type { CodeSymbol, Dependency, Relationship } from '../types/maps.js';
import type { SymbolExtractionResult } from './ts-symbol-extractor.js';

// Handles Java (.java) and Kotlin (.kt, .kts)
export function extractJvmSymbols(
  sourceText: string,
  filePath: string,
): SymbolExtractionResult {
  const ext =
    filePath.endsWith('.kt') || filePath.endsWith('.kts') ? 'kotlin' : 'java';
  const lines = sourceText.split('\n');
  const symbols: CodeSymbol[] = [];
  const dependencies: Dependency[] = [];
  const relationships: Relationship[] = [];
  const warnings: string[] = [];

  // Stack tracks class/object/interface scope
  const typeStack: Array<{ name: string; braceDepth: number }> = [];
  let braceDepth = 0;

  const addSymbol = (
    name: string,
    kind: CodeSymbol['kind'],
    lineNum: number,
    exported: boolean,
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
      exported,
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
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*'))
      continue;

    braceDepth +=
      (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;

    while (
      typeStack.length > 0 &&
      braceDepth < typeStack[typeStack.length - 1].braceDepth
    ) {
      typeStack.pop();
    }

    // import statement
    const importMatch = trimmed.match(/^import\s+([\w.]+(?:\.\*)?)/);
    if (importMatch) {
      const specifier = importMatch[1].replace(/\.\*$/, '');
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

    if (ext === 'java') {
      // class / interface / enum / @interface
      const typeMatch = trimmed.match(
        /\b(?:public\s+|private\s+|protected\s+|abstract\s+|final\s+)*(?:class|interface|enum|@interface)\s+(\w+)/,
      );
      if (typeMatch) {
        const parent = typeStack[typeStack.length - 1];
        const exported = trimmed.includes('public');
        addSymbol(typeMatch[1], 'class', lineNum, exported, parent?.name);
        typeStack.push({ name: typeMatch[1], braceDepth });
        continue;
      }

      // method: visibility returnType methodName(
      // Avoid matching field declarations (no parenthesis)
      const methodMatch = trimmed.match(
        /\b(?:public|private|protected|static|final|synchronized|abstract|native|default|void|@Override\s+(?:public|protected))\b.*\s+(\w+)\s*\(/,
      );
      if (methodMatch && !trimmed.startsWith('//')) {
        const parent = typeStack[typeStack.length - 1];
        const exported = trimmed.includes('public');
        const kind: CodeSymbol['kind'] = parent ? 'method' : 'function';
        addSymbol(methodMatch[1], kind, lineNum, exported, parent?.name);
        continue;
      }
    }

    if (ext === 'kotlin') {
      // class / interface / object / data class / sealed class
      const typeMatch = trimmed.match(
        /\b(?:data\s+|sealed\s+|abstract\s+|open\s+|inner\s+)?(?:class|interface|object|enum\s+class)\s+(\w+)/,
      );
      if (typeMatch) {
        const parent = typeStack[typeStack.length - 1];
        const exported =
          !trimmed.startsWith('private') && !trimmed.startsWith('internal');
        addSymbol(typeMatch[1], 'class', lineNum, exported, parent?.name);
        typeStack.push({ name: typeMatch[1], braceDepth });
        continue;
      }

      // fun
      const funcMatch = trimmed.match(/\bfun\s+(\w+)\s*[(<]/);
      if (funcMatch) {
        const parent = typeStack[typeStack.length - 1];
        const exported =
          !trimmed.startsWith('private') && !trimmed.startsWith('internal');
        const kind: CodeSymbol['kind'] = parent ? 'method' : 'function';
        addSymbol(funcMatch[1], kind, lineNum, exported, parent?.name);
        continue;
      }
    }
  }

  return { symbols, dependencies, relationships, warnings };
}
