import type { CodeSymbol, Dependency, Relationship } from '../types/maps.js';
import type { SymbolExtractionResult } from './ts-symbol-extractor.js';

// Handles C (.c, .h) and C++ (.cpp, .cc, .cxx, .hpp, .hxx)
export function extractCSymbols(
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

    // #include <...> or #include "..."
    const includeMatch = trimmed.match(/^#include\s+[<"]([^>"]+)[>"]/);
    if (includeMatch) {
      const specifier = includeMatch[1];
      const kind = trimmed.includes('"') ? 'local' : 'package';
      dependencies.push({ fromFile: filePath, specifier, kind });
      relationships.push({
        sourceType: 'file',
        sourceId: filePath,
        targetType: kind === 'local' ? 'file' : 'package',
        targetId: specifier,
        relationshipType: 'import',
        confidence: 'high',
      });
      continue;
    }

    // class / struct (C++ with body — has name before {)
    const classMatch = trimmed.match(
      /\b(?:class|struct)\s+(\w+)\s*(?::[^{]*)?\s*\{/,
    );
    if (classMatch) {
      addSymbol(
        classMatch[1],
        'class',
        lineNum,
        typeStack[typeStack.length - 1]?.name,
      );
      typeStack.push({ name: classMatch[1], braceDepth });
      continue;
    }

    // Function definition: returnType funcName( — must have ( and no ; on same line
    // Exclude preprocessor, declarations without body
    if (!trimmed.endsWith(';') && !trimmed.startsWith('#')) {
      const funcMatch = trimmed.match(
        /\b(\w+)\s*\((?:[^)]*)?\)\s*(?:const\s*)?(?:noexcept\s*)?(?:override\s*)?(?:final\s*)?\{?$/,
      );
      // Filter out common false positives: if/for/while/switch/catch/else
      const CONTROL_FLOW = new Set([
        'if',
        'for',
        'while',
        'switch',
        'catch',
        'else',
        'return',
        'sizeof',
        'typeof',
      ]);
      if (
        funcMatch &&
        !CONTROL_FLOW.has(funcMatch[1]) &&
        funcMatch[1] !== 'class' &&
        funcMatch[1] !== 'struct'
      ) {
        const parent = typeStack[typeStack.length - 1];
        const kind: CodeSymbol['kind'] = parent ? 'method' : 'function';
        addSymbol(funcMatch[1], kind, lineNum, parent?.name);
        continue;
      }
    }
  }

  return { symbols, dependencies, relationships, warnings };
}
