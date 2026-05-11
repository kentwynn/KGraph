import type { Node } from 'web-tree-sitter';
import type { CodeSymbol, Dependency, Relationship } from '../types/maps.js';
import { parseSource } from './tree-sitter-parser.js';
import type { SymbolExtractionResult } from './ts-symbol-extractor.js';

type GrammarKey = 'java' | 'kotlin';

// Handles Java (.java) and Kotlin (.kt, .kts)
export async function extractJvmSymbols(
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

  const lang: GrammarKey =
    filePath.endsWith('.kt') || filePath.endsWith('.kts') ? 'kotlin' : 'java';
  const tree = await parseSource(sourceText, lang);

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

  function hasModifier(node: Node, modifier: string): boolean {
    const mods =
      node.childForFieldName('modifiers') ??
      node.namedChildren.find((c) => c.type === 'modifiers');
    if (!mods) return false;
    return mods.text.includes(modifier);
  }

  function walkJava(node: Node, parentClassName?: string): void {
    switch (node.type) {
      case 'import_declaration': {
        // Java import: scoped_identifier child
        const scopedId = node.namedChildren.find(
          (c) => c.type === 'scoped_identifier' || c.type === 'identifier',
        );
        if (scopedId) {
          const specifier = scopedId.text.replace(/\.\*$/, '');
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

      case 'class_declaration':
      case 'interface_declaration':
      case 'enum_declaration':
      case 'annotation_type_declaration': {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          const exported = hasModifier(node, 'public');
          addSymbol(
            nameNode.text,
            'class',
            node.startPosition.row + 1,
            node.endPosition.row + 1,
            exported,
            parentClassName,
          );
          // Walk class body for methods and nested types
          const body =
            node.childForFieldName('body') ??
            node.namedChildren.find(
              (c) =>
                c.type === 'class_body' ||
                c.type === 'interface_body' ||
                c.type === 'enum_body',
            );
          if (body) {
            for (const child of body.namedChildren) {
              walkJava(child, nameNode.text);
            }
          }
        }
        return;
      }

      case 'method_declaration':
      case 'constructor_declaration': {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          const exported = hasModifier(node, 'public');
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
      walkJava(child, parentClassName);
    }
  }

  function walkKotlin(node: Node, parentClassName?: string): void {
    switch (node.type) {
      case 'import': {
        // Kotlin import: qualified_identifier child
        const qualId = node.namedChildren.find(
          (c) => c.type === 'qualified_identifier' || c.type === 'identifier',
        );
        if (qualId) {
          const specifier = qualId.text;
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

      case 'class_declaration': {
        const nameNode =
          node.childForFieldName('name') ??
          node.namedChildren.find((c) => c.type === 'identifier');
        if (nameNode) {
          const exported =
            !hasModifier(node, 'private') && !hasModifier(node, 'internal');
          addSymbol(
            nameNode.text,
            'class',
            node.startPosition.row + 1,
            node.endPosition.row + 1,
            exported,
            parentClassName,
          );
          // Walk class body
          const body = node.namedChildren.find((c) => c.type === 'class_body');
          if (body) {
            for (const child of body.namedChildren) {
              walkKotlin(child, nameNode.text);
            }
          }
        }
        return;
      }

      case 'object_declaration': {
        const nameNode = node.namedChildren.find(
          (c) => c.type === 'identifier',
        );
        if (nameNode) {
          const exported =
            !hasModifier(node, 'private') && !hasModifier(node, 'internal');
          addSymbol(
            nameNode.text,
            'class',
            node.startPosition.row + 1,
            node.endPosition.row + 1,
            exported,
            parentClassName,
          );
          const body = node.namedChildren.find((c) => c.type === 'class_body');
          if (body) {
            for (const child of body.namedChildren) {
              walkKotlin(child, nameNode.text);
            }
          }
        }
        return;
      }

      case 'function_declaration': {
        const nameNode = node.namedChildren.find(
          (c) => c.type === 'identifier',
        );
        if (nameNode) {
          const exported =
            !hasModifier(node, 'private') && !hasModifier(node, 'internal');
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
      walkKotlin(child, parentClassName);
    }
  }

  if (lang === 'java') {
    walkJava(tree.rootNode);
  } else {
    walkKotlin(tree.rootNode);
  }

  tree.delete();

  return { symbols, dependencies, relationships, warnings };
}
