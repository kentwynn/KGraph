import type { Node } from 'web-tree-sitter';
import type { CodeSymbol, Dependency, Relationship } from '../types/maps.js';
import { parseSource } from './tree-sitter-parser.js';
import type { SymbolExtractionResult } from './ts-symbol-extractor.js';

export async function extractRustSymbols(
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

  const tree = await parseSource(sourceText, 'rust');

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

  function hasPub(node: Node): boolean {
    return node.namedChildren.some((c) => c.type === 'visibility_modifier');
  }

  function extractUseSpecifier(node: Node): string {
    // use_declaration has a child tree of scoped_identifier / scoped_use_list / use_wildcard
    // We want the text without 'use' and ';'
    for (const child of node.namedChildren) {
      if (child.type !== 'visibility_modifier') {
        return child.text;
      }
    }
    return '';
  }

  function walk(node: Node, implTypeName?: string): void {
    switch (node.type) {
      case 'use_declaration': {
        const specifier = extractUseSpecifier(node);
        if (specifier) {
          const kind =
            specifier.startsWith('crate::') ||
            specifier.startsWith('super::') ||
            specifier.startsWith('self::')
              ? 'local'
              : 'package';
          dependencies.push({
            fromFile: filePath,
            specifier,
            kind,
          } as Dependency);
          relationships.push({
            sourceType: 'file',
            sourceId: filePath,
            targetType: kind === 'local' ? 'file' : 'package',
            targetId: specifier,
            relationshipType: 'import',
            confidence: 'high',
          });
        }
        return;
      }

      case 'struct_item':
      case 'enum_item':
      case 'trait_item': {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          addSymbol(
            nameNode.text,
            'class',
            node.startPosition.row + 1,
            node.endPosition.row + 1,
            hasPub(node),
          );
        }
        return;
      }

      case 'impl_item': {
        // impl TypeName { ... } or impl Trait for TypeName { ... }
        const typeNode = node.childForFieldName('type');
        const typeName =
          typeNode?.type === 'type_identifier' ? typeNode.text : typeNode?.text;
        const body =
          node.childForFieldName('body') ??
          node.namedChildren.find((c) => c.type === 'declaration_list');
        if (body && typeName) {
          for (const child of body.namedChildren) {
            walk(child, typeName);
          }
        }
        return;
      }

      case 'function_item': {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          const exported = hasPub(node);
          if (implTypeName) {
            addSymbol(
              nameNode.text,
              'method',
              node.startPosition.row + 1,
              node.endPosition.row + 1,
              exported,
              implTypeName,
            );
          } else {
            addSymbol(
              nameNode.text,
              'function',
              node.startPosition.row + 1,
              node.endPosition.row + 1,
              exported,
            );
          }
        }
        return;
      }

      case 'function_signature_item': {
        // trait method signatures
        const nameNode = node.childForFieldName('name');
        if (nameNode && implTypeName) {
          addSymbol(
            nameNode.text,
            'method',
            node.startPosition.row + 1,
            node.endPosition.row + 1,
            false,
            implTypeName,
          );
        }
        return;
      }
    }

    for (const child of node.namedChildren) {
      walk(child, implTypeName);
    }
  }

  walk(tree.rootNode);
  tree.delete();

  return { symbols, dependencies, relationships, warnings };
}
