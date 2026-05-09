import type { CodeSymbol, Dependency, Relationship } from '../types/maps.js';
import type { SymbolExtractionResult } from './ts-symbol-extractor.js';

export function extractRustSymbols(
  sourceText: string,
  filePath: string,
): SymbolExtractionResult {
  const lines = sourceText.split('\n');
  const symbols: CodeSymbol[] = [];
  const dependencies: Dependency[] = [];
  const relationships: Relationship[] = [];
  const warnings: string[] = [];

  // Track current impl block: { typeName, indent }
  const implStack: Array<{ typeName: string; braceDepth: number }> = [];
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
    // Rust: pub = exported
    symbols.push({
      id,
      name,
      kind,
      filePath,
      startLine: lineNum,
      endLine: lineNum,
      exported: false, // set by caller
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

  const addSymbolExported = (
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

    if (!trimmed || trimmed.startsWith('//')) continue;

    // Track brace depth for impl block scoping
    braceDepth +=
      (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;

    // Pop impl blocks we've exited
    while (
      implStack.length > 0 &&
      braceDepth < implStack[implStack.length - 1].braceDepth
    ) {
      implStack.pop();
    }

    // use statement: use crate::path or use external::path
    const useMatch = trimmed.match(/^use\s+([\w:]+)/);
    if (useMatch) {
      const specifier = useMatch[1];
      const kind =
        specifier.startsWith('crate::') ||
        specifier.startsWith('super::') ||
        specifier.startsWith('self::')
          ? 'local'
          : 'package';
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

    // impl block: impl TypeName or impl Trait for TypeName
    const implMatch = trimmed.match(
      /^impl(?:<[^>]*>)?\s+(?:\w+\s+for\s+)?(\w+)/,
    );
    if (implMatch) {
      implStack.push({ typeName: implMatch[1], braceDepth });
      continue;
    }

    // struct / enum / trait definition
    const typeMatch = trimmed.match(/^(pub\s+)?(?:struct|enum|trait)\s+(\w+)/);
    if (typeMatch) {
      addSymbolExported(typeMatch[2], 'class', lineNum, !!typeMatch[1]);
      continue;
    }

    // fn definition (inside or outside impl)
    const fnMatch = trimmed.match(/^(pub\s+)?(?:async\s+)?fn\s+(\w+)/);
    if (fnMatch) {
      const exported = !!fnMatch[1];
      const name = fnMatch[2];
      const parent = implStack[implStack.length - 1];
      if (parent) {
        addSymbolExported(name, 'method', lineNum, exported, parent.typeName);
      } else {
        addSymbolExported(name, 'function', lineNum, exported);
      }
      continue;
    }
  }

  return { symbols, dependencies, relationships, warnings };
}
