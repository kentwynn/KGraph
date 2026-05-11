import type { Node } from 'web-tree-sitter';
import type {
  CodeSymbol,
  Dependency,
  DependencyKind,
  Relationship,
} from '../types/maps.js';
import { parseSource } from './tree-sitter-parser.js';
import type { SymbolExtractionResult } from './ts-symbol-extractor.js';

export async function extractPythonSymbols(
  sourceText: string,
  filePath: string,
): Promise<SymbolExtractionResult> {
  const symbols: CodeSymbol[] = [];
  const dependencies: Dependency[] = [];
  const relationships: Relationship[] = [];
  const warnings: string[] = [];

  if (!sourceText.trim()) {
    return { symbols, dependencies, relationships, warnings };
  }

  const tree = await parseSource(sourceText, 'python');

  const addSymbol = (
    name: string,
    kind: CodeSymbol['kind'],
    startLine: number,
    endLine: number,
    exported: boolean,
    parentName?: string,
  ): void => {
    const id = [filePath, kind, parentName, name, startLine]
      .filter(Boolean)
      .join('#');
    symbols.push({
      id,
      name,
      kind,
      filePath,
      startLine,
      endLine,
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

  function walk(node: Node, parentClassName?: string): void {
    switch (node.type) {
      case 'class_definition': {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          const startLine = node.startPosition.row + 1;
          const endLine = node.endPosition.row + 1;
          addSymbol(
            nameNode.text,
            'class',
            startLine,
            endLine,
            false,
            parentClassName,
          );
          // Walk children for nested classes/methods
          const body = node.childForFieldName('body');
          if (body) {
            for (const child of body.namedChildren) {
              walk(child, nameNode.text);
            }
          }
        }
        return; // Don't recurse further from here
      }

      case 'function_definition': {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          const startLine = node.startPosition.row + 1;
          const endLine = node.endPosition.row + 1;
          const kind: CodeSymbol['kind'] = parentClassName
            ? 'method'
            : 'function';
          addSymbol(
            nameNode.text,
            kind,
            startLine,
            endLine,
            false,
            parentClassName,
          );
        }
        return; // Don't recurse into function bodies
      }

      case 'import_statement': {
        // import os / import os.path
        const startLine = node.startPosition.row + 1;
        for (const child of node.namedChildren) {
          if (child.type === 'dotted_name' || child.type === 'aliased_import') {
            const specifier =
              child.type === 'aliased_import'
                ? (child.childForFieldName('name')?.text ?? child.text)
                : child.text;
            dependencies.push({
              fromFile: filePath,
              specifier,
              kind: 'package',
            });
            addSymbol(specifier, 'import', startLine, startLine, false);
            relationships.push({
              sourceType: 'file',
              sourceId: filePath,
              targetType: 'package',
              targetId: specifier,
              relationshipType: 'import',
              confidence: 'high',
            });
          }
        }
        return;
      }

      case 'import_from_statement': {
        // from X import Y
        const moduleNode = node.childForFieldName('module_name');
        if (moduleNode) {
          const specifier = moduleNode.text;
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
        return;
      }
    }

    // Recurse into children for top-level statements
    for (const child of node.namedChildren) {
      walk(child, parentClassName);
    }
  }

  walk(tree.rootNode);
  tree.delete();

  return { symbols, dependencies, relationships, warnings };
}
