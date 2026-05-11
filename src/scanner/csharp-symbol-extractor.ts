import type { Node } from 'web-tree-sitter';
import type { CodeSymbol, Dependency, Relationship } from '../types/maps.js';
import { parseSource } from './tree-sitter-parser.js';
import type { SymbolExtractionResult } from './ts-symbol-extractor.js';

export async function extractCSharpSymbols(
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

  const tree = await parseSource(sourceText, 'c_sharp');

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

  function hasVisibility(node: Node, vis: string): boolean {
    for (const child of node.children) {
      if (child.type === 'modifier' && child.text === vis) return true;
    }
    return false;
  }

  function isExported(node: Node): boolean {
    return hasVisibility(node, 'public') || hasVisibility(node, 'internal');
  }

  function walk(node: Node, parentClassName?: string): void {
    switch (node.type) {
      case 'using_directive': {
        // using System; or using System.Collections.Generic;
        const nameNode =
          node.namedChildren.find((c) => c.type === 'qualified_name') ??
          node.namedChildren.find((c) => c.type === 'identifier');
        if (nameNode) {
          const specifier = nameNode.text;
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
        return;
      }

      case 'namespace_declaration':
      case 'file_scoped_namespace_declaration': {
        // Recurse into namespace body
        const body =
          node.childForFieldName('body') ??
          node.namedChildren.find((c) => c.type === 'declaration_list');
        if (body) {
          for (const child of body.namedChildren) {
            walk(child, parentClassName);
          }
        } else {
          // file-scoped namespace: declarations are siblings
          for (const child of node.namedChildren) {
            walk(child, parentClassName);
          }
        }
        return;
      }

      case 'class_declaration':
      case 'interface_declaration':
      case 'struct_declaration':
      case 'enum_declaration':
      case 'record_declaration': {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          const exported = isExported(node);
          addSymbol(
            nameNode.text,
            'class',
            node.startPosition.row + 1,
            node.endPosition.row + 1,
            exported,
            parentClassName,
          );
          // Walk body for methods and nested types
          const body =
            node.childForFieldName('body') ??
            node.namedChildren.find((c) => c.type === 'declaration_list');
          if (body) {
            for (const child of body.namedChildren) {
              walk(child, nameNode.text);
            }
          }
        }
        return;
      }

      case 'method_declaration':
      case 'constructor_declaration': {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          const exported = isExported(node);
          const kind: CodeSymbol['kind'] = parentClassName
            ? 'method'
            : 'function';
          addSymbol(
            nameNode.text,
            kind,
            node.startPosition.row + 1,
            node.endPosition.row + 1,
            exported,
            parentClassName,
          );
        }
        return;
      }
    }

    for (const child of node.namedChildren) {
      walk(child, parentClassName);
    }
  }

  walk(tree.rootNode);
  tree.delete();

  return { symbols, dependencies, relationships, warnings };
}
