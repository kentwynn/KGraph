import type { Node } from 'web-tree-sitter';
import type { CodeSymbol, Dependency, Relationship } from '../types/maps.js';
import { parseSource } from './tree-sitter-parser.js';
import type { SymbolExtractionResult } from './ts-symbol-extractor.js';

export async function extractGoSymbols(
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

  const tree = await parseSource(sourceText, 'go');

  const addSymbol = (
    name: string,
    kind: CodeSymbol['kind'],
    startLine: number,
    endLine: number,
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

  function extractImportSpec(node: Node): void {
    // import_spec contains an interpreted_string_literal with the path
    const pathNode = node.namedChildren.find(
      (c) => c.type === 'interpreted_string_literal',
    );
    if (pathNode) {
      // Strip quotes from the string literal
      const specifier = pathNode.text.replace(/^"|"$/g, '');
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
  }

  function walk(node: Node): void {
    switch (node.type) {
      case 'import_declaration': {
        // Could contain import_spec_list or a single import_spec
        for (const child of node.namedChildren) {
          if (child.type === 'import_spec_list') {
            for (const spec of child.namedChildren) {
              if (spec.type === 'import_spec') {
                extractImportSpec(spec);
              }
            }
          } else if (child.type === 'import_spec') {
            extractImportSpec(child);
          }
        }
        return;
      }

      case 'type_declaration': {
        // type_declaration contains type_spec children
        for (const child of node.namedChildren) {
          if (child.type === 'type_spec') {
            const nameNode = child.childForFieldName('name');
            if (nameNode) {
              addSymbol(
                nameNode.text,
                'class',
                node.startPosition.row + 1,
                node.endPosition.row + 1,
              );
            }
          }
        }
        return;
      }

      case 'function_declaration': {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          addSymbol(
            nameNode.text,
            'function',
            node.startPosition.row + 1,
            node.endPosition.row + 1,
          );
        }
        return;
      }

      case 'method_declaration': {
        const nameNode = node.childForFieldName('name');
        const receiverNode = node.childForFieldName('receiver');
        let parentName: string | undefined;
        if (receiverNode) {
          // receiver is a parameter_list with a parameter_declaration inside
          // that contains the type (possibly pointer_type wrapping type_identifier)
          const typeNode = receiverNode.descendantsOfType('type_identifier')[0];
          if (typeNode) {
            parentName = typeNode.text;
          }
        }
        if (nameNode) {
          addSymbol(
            nameNode.text,
            'method',
            node.startPosition.row + 1,
            node.endPosition.row + 1,
            parentName,
          );
        }
        return;
      }
    }

    for (const child of node.namedChildren) {
      walk(child);
    }
  }

  walk(tree.rootNode);
  tree.delete();

  return { symbols, dependencies, relationships, warnings };
}
