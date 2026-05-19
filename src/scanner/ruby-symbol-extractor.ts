import type { Node } from 'web-tree-sitter';
import type { CodeSymbol } from '../types/maps.js';
import {
  emptyExtractionResult,
  ExtractionContext,
} from './extraction-context.js';
import { parseSource } from './tree-sitter-parser.js';
import type { SymbolExtractionResult } from './ts-symbol-extractor.js';

export async function extractRubySymbols(
  sourceText: string,
  filePath: string,
): Promise<SymbolExtractionResult> {
  if (!sourceText.trim()) {
    return emptyExtractionResult();
  }

  const tree = await parseSource(sourceText, 'ruby');
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

  function walk(node: Node, parentName?: string): void {
    switch (node.type) {
      case 'call': {
        const methodName = findCallMethodName(node);
        if (methodName === 'require' || methodName === 'require_relative') {
          const argument = findFirstStringContent(node);
          if (argument) {
            context.addDependency(
              argument,
              methodName === 'require_relative' ? 'local' : 'package',
            );
          }
          return;
        }
        break;
      }

      case 'class':
      case 'module': {
        const symbol = addNamedSymbol(
          node,
          node.type === 'class' ? 'class' : 'type',
          parentName,
        );
        const nextParent = symbol?.name ?? parentName;
        for (const child of node.namedChildren) {
          walk(child, nextParent);
        }
        return;
      }

      case 'method':
      case 'singleton_method': {
        const symbol = addNamedSymbol(
          node,
          parentName ? 'method' : 'function',
          parentName,
        );
        if (symbol && parentName) {
          const parent = context.symbols.find(
            (candidate) =>
              candidate.name === parentName &&
              (candidate.kind === 'class' || candidate.kind === 'type'),
          );
          if (parent) context.addSymbolContains(parent, symbol);
        }
        return;
      }
    }

    for (const child of node.namedChildren) {
      walk(child, parentName);
    }
  }

  walk(tree.rootNode);
  tree.delete();
  return context.toResult();
}

function findNameNode(node: Node): Node | undefined {
  return (
    node.childForFieldName('name') ??
    node.namedChildren.find((child) => child.type === 'constant') ??
    node.namedChildren.find((child) => child.type === 'identifier')
  );
}

function findCallMethodName(node: Node): string | undefined {
  return (
    node.childForFieldName('method')?.text ??
    node.namedChildren.find((child) => child.type === 'identifier')?.text
  );
}

function findFirstStringContent(node: Node): string | undefined {
  return node.descendantsOfType('string_content')[0]?.text;
}
