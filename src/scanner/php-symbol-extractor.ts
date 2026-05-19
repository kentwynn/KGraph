import type { Node } from 'web-tree-sitter';
import type { CodeSymbol } from '../types/maps.js';
import {
  emptyExtractionResult,
  ExtractionContext,
} from './extraction-context.js';
import { parseSource } from './tree-sitter-parser.js';
import type { SymbolExtractionResult } from './ts-symbol-extractor.js';

export async function extractPhpSymbols(
  sourceText: string,
  filePath: string,
): Promise<SymbolExtractionResult> {
  if (!sourceText.trim()) {
    return emptyExtractionResult();
  }

  const tree = await parseSource(sourceText, 'php');
  const context = new ExtractionContext(filePath);

  function addNamedSymbol(
    node: Node,
    kind: CodeSymbol['kind'],
    parentName?: string,
  ): CodeSymbol | undefined {
    const nameNode = findNameNode(node);
    if (!nameNode) return undefined;
    return context.addSymbol({
      name: nameNode.text,
      kind,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      exported: true,
      parentName,
    });
  }

  function walk(node: Node, parentClassName?: string): void {
    switch (node.type) {
      case 'namespace_definition':
      case 'namespace_name': {
        if (node.type === 'namespace_name' && !parentClassName) {
          context.addSymbol({
            name: node.text,
            kind: 'type',
            startLine: node.startPosition.row + 1,
            endLine: node.endPosition.row + 1,
            exported: true,
          });
          return;
        }
        break;
      }

      case 'namespace_use_declaration': {
        for (const nameNode of node.descendantsOfType('qualified_name')) {
          context.addDependency(nameNode.text, 'package');
        }
        return;
      }

      case 'class_declaration':
      case 'interface_declaration':
      case 'trait_declaration':
      case 'enum_declaration': {
        const classSymbol = addNamedSymbol(
          node,
          node.type === 'interface_declaration' ? 'interface' : 'class',
          parentClassName,
        );
        const className = classSymbol?.name ?? parentClassName;
        for (const child of node.namedChildren) {
          walk(child, className);
        }
        return;
      }

      case 'function_definition':
      case 'method_declaration': {
        const symbol = addNamedSymbol(
          node,
          parentClassName ? 'method' : 'function',
          parentClassName,
        );
        if (symbol && parentClassName) {
          const parent = context.symbols.find(
            (candidate) =>
              candidate.name === parentClassName && candidate.kind === 'class',
          );
          if (parent) context.addSymbolContains(parent, symbol);
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
  return context.toResult();
}

function findNameNode(node: Node): Node | undefined {
  return (
    node.childForFieldName('name') ??
    node.namedChildren.find((child) => child.type === 'name') ??
    node.namedChildren.find((child) => child.type === 'variable_name') ??
    node.namedChildren.find((child) => child.type === 'identifier')
  );
}
