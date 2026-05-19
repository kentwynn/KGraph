import type { Node } from 'web-tree-sitter';
import {
  emptyExtractionResult,
  ExtractionContext,
} from './extraction-context.js';
import { parseSource } from './tree-sitter-parser.js';
import type { SymbolExtractionResult } from './ts-symbol-extractor.js';

export async function extractShellSymbols(
  sourceText: string,
  filePath: string,
): Promise<SymbolExtractionResult> {
  if (!sourceText.trim()) {
    return emptyExtractionResult();
  }

  const tree = await parseSource(sourceText, 'bash');
  const context = new ExtractionContext(filePath);

  function walk(node: Node, currentFunctionId?: string): void {
    switch (node.type) {
      case 'function_definition': {
        const name = findFunctionName(node);
        if (name) {
          const symbol = context.addSymbol({
            name,
            kind: 'function',
            startLine: node.startPosition.row + 1,
            endLine: node.endPosition.row + 1,
            exported: true,
          });
          for (const child of node.namedChildren) {
            walk(child, symbol.id);
          }
          return;
        }
        break;
      }

      case 'command': {
        const commandName = findCommandName(node);
        const firstArgument = findFirstCommandArgument(node);
        if (
          (commandName === 'source' || commandName === '.') &&
          firstArgument
        ) {
          context.addDependency(firstArgument, 'local');
          return;
        }
        if (currentFunctionId && commandName && isLocalScriptReference(commandName)) {
          context.relationships.push({
            sourceType: 'symbol',
            sourceId: currentFunctionId,
            targetType: 'file',
            targetId: commandName,
            relationshipType: 'calls',
            confidence: 'low',
          });
        }
        break;
      }
    }

    for (const child of node.namedChildren) {
      walk(child, currentFunctionId);
    }
  }

  walk(tree.rootNode);
  tree.delete();
  return context.toResult();
}

function findFunctionName(node: Node): string | undefined {
  return (
    node.childForFieldName('name')?.text ??
    node.namedChildren.find((child) => child.type === 'word')?.text
  );
}

function findCommandName(node: Node): string | undefined {
  return (
    node.childForFieldName('name')?.text ??
    node.namedChildren
      .find((child) => child.type === 'command_name')
      ?.namedChildren.find((child) => child.type === 'word')?.text ??
    node.namedChildren.find((child) => child.type === 'command_name')?.text ??
    node.namedChildren.find((child) => child.type === 'word')?.text
  );
}

function findFirstCommandArgument(node: Node): string | undefined {
  return node.namedChildren.find((child) => child.type === 'word')?.text;
}

function isLocalScriptReference(value: string): boolean {
  return (
    value.startsWith('./') ||
    value.startsWith('../') ||
    value.endsWith('.sh') ||
    value.endsWith('.bash') ||
    value.endsWith('.zsh')
  );
}
