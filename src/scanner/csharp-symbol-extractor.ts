import type { CodeSymbol, Dependency, Relationship } from '../types/maps.js';
import type { SymbolExtractionResult } from './ts-symbol-extractor.js';

export function extractCSharpSymbols(
  sourceText: string,
  filePath: string,
): SymbolExtractionResult {
  const lines = sourceText.split('\n');
  const symbols: CodeSymbol[] = [];
  const dependencies: Dependency[] = [];
  const relationships: Relationship[] = [];
  const warnings: string[] = [];

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

    // using statement
    const usingMatch = trimmed.match(/^using\s+([\w.]+)\s*;/);
    if (usingMatch) {
      const specifier = usingMatch[1];
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

    // class / interface / struct / enum / record
    const typeMatch = trimmed.match(
      /\b(?:public|private|protected|internal|static|abstract|sealed|partial|readonly)?\s*(?:public|private|protected|internal|static|abstract|sealed|partial|readonly)?\s*(?:class|interface|struct|enum|record)\s+(\w+)/,
    );
    if (typeMatch && typeMatch[1]) {
      const parent = typeStack[typeStack.length - 1];
      const exported =
        trimmed.includes('public') || trimmed.includes('internal');
      addSymbol(typeMatch[1], 'class', lineNum, exported, parent?.name);
      typeStack.push({ name: typeMatch[1], braceDepth });
      continue;
    }

    // method: visibility [modifiers] returnType MethodName(
    // Must have parens, no semicolon (not a field), not a control-flow keyword
    const CONTROL_FLOW = new Set([
      'if',
      'for',
      'foreach',
      'while',
      'switch',
      'catch',
      'else',
      'using',
      'lock',
      'return',
    ]);
    if (!trimmed.endsWith(';')) {
      // Strip generic type parameters (e.g. Task<string> → Task) before matching method name
      const normalizedForMethod = trimmed.replace(/<[^>]*>/g, '');
      const methodMatch = normalizedForMethod.match(
        /\b(?:public|private|protected|internal|static|virtual|override|abstract|async|new|sealed)[\w\s]*\s+(\w+)\s*\(/,
      );
      if (methodMatch && !CONTROL_FLOW.has(methodMatch[1])) {
        const parent = typeStack[typeStack.length - 1];
        const exported =
          trimmed.includes('public') || trimmed.includes('internal');
        const kind: CodeSymbol['kind'] = parent ? 'method' : 'function';
        addSymbol(methodMatch[1], kind, lineNum, exported, parent?.name);
        continue;
      }
    }
  }

  return { symbols, dependencies, relationships, warnings };
}
