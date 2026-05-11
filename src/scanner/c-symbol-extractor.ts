import type { Node } from 'web-tree-sitter';
import type { CodeSymbol, Dependency, Relationship } from '../types/maps.js';
import { parseSource } from './tree-sitter-parser.js';
import type { SymbolExtractionResult } from './ts-symbol-extractor.js';

const CPP_EXTS = new Set(['.cpp', '.cc', '.cxx', '.hpp', '.hxx']);

// Handles C (.c, .h) and C++ (.cpp, .cc, .cxx, .hpp, .hxx)
export async function extractCSymbols(
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

  const ext = filePath.substring(filePath.lastIndexOf('.'));
  const grammar = CPP_EXTS.has(ext) ? 'cpp' : 'c';
  const tree = await parseSource(sourceText, grammar);

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

  function getFuncName(node: Node): string | null {
    // function_definition has a function_declarator child which contains the identifier
    const declarator = node.childForFieldName('declarator');
    if (!declarator) return null;
    if (declarator.type === 'function_declarator') {
      const nameNode = declarator.childForFieldName('declarator');
      return nameNode?.text ?? null;
    }
    // For pointer_declarator wrapping function_declarator
    const funcDecl = declarator.descendantsOfType('function_declarator')[0];
    if (funcDecl) {
      const nameNode = funcDecl.childForFieldName('declarator');
      return nameNode?.text ?? null;
    }
    return null;
  }

  function walk(node: Node, parentClassName?: string): void {
    switch (node.type) {
      case 'preproc_include': {
        // #include <...> or #include "..."
        const pathNode =
          node.namedChildren.find((c) => c.type === 'system_lib_string') ??
          node.namedChildren.find((c) => c.type === 'string_literal');
        if (pathNode) {
          let specifier: string;
          let kind: 'local' | 'package';
          if (pathNode.type === 'system_lib_string') {
            // <iostream> — strip angle brackets
            specifier = pathNode.text.replace(/^<|>$/g, '');
            kind = 'package';
          } else {
            // "myheader.h" — extract string content
            const content = pathNode.namedChildren.find(
              (c) => c.type === 'string_content',
            );
            specifier = content?.text ?? pathNode.text.replace(/^"|"$/g, '');
            kind = 'local';
          }
          dependencies.push({ fromFile: filePath, specifier, kind });
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

      case 'class_specifier':
      case 'struct_specifier': {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          addSymbol(
            nameNode.text,
            'class',
            node.startPosition.row + 1,
            node.endPosition.row + 1,
            parentClassName,
          );
          // Walk body for methods
          const body = node.childForFieldName('body');
          if (body) {
            for (const child of body.namedChildren) {
              walk(child, nameNode.text);
            }
          }
        }
        return;
      }

      case 'function_definition': {
        const name = getFuncName(node);
        if (name) {
          const kind: CodeSymbol['kind'] = parentClassName
            ? 'method'
            : 'function';
          addSymbol(
            name,
            kind,
            node.startPosition.row + 1,
            node.endPosition.row + 1,
            parentClassName,
          );
        }
        return;
      }

      case 'declaration': {
        // Could be a function declaration (prototype) inside a class
        if (parentClassName) {
          const declarator = node.childForFieldName('declarator');
          if (declarator) {
            const funcDecl =
              declarator.type === 'function_declarator'
                ? declarator
                : declarator.descendantsOfType('function_declarator')[0];
            if (funcDecl) {
              const nameNode = funcDecl.childForFieldName('declarator');
              if (nameNode) {
                addSymbol(
                  nameNode.text,
                  'method',
                  node.startPosition.row + 1,
                  node.endPosition.row + 1,
                  parentClassName,
                );
              }
              return;
            }
          }
        }
        break;
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
