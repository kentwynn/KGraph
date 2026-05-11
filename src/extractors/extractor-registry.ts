import type { ExtractorName } from '../types/config.js';

export interface ExtractorAdapter {
  name: ExtractorName;
  label: string;
  packageName: string;
  languages: string[];
}

const ADAPTERS: ExtractorAdapter[] = [
  {
    name: 'python' as const,
    label: 'Python deep extractor',
    packageName: '@kentwynn/kgraph-extractor-python',
    languages: ['python'],
  },
  {
    name: 'jvm' as const,
    label: 'JVM deep extractor',
    packageName: '@kentwynn/kgraph-extractor-jvm',
    languages: ['java', 'kotlin'],
  },
  {
    name: 'go' as const,
    label: 'Go deep extractor',
    packageName: '@kentwynn/kgraph-extractor-go',
    languages: ['go'],
  },
  {
    name: 'rust' as const,
    label: 'Rust deep extractor',
    packageName: '@kentwynn/kgraph-extractor-rust',
    languages: ['rust'],
  },
  {
    name: 'c-family' as const,
    label: 'C/C++ deep extractor',
    packageName: '@kentwynn/kgraph-extractor-c-family',
    languages: ['c', 'cpp'],
  },
  {
    name: 'csharp' as const,
    label: 'C# deep extractor',
    packageName: '@kentwynn/kgraph-extractor-csharp',
    languages: ['csharp'],
  },
].sort((left, right) => left.name.localeCompare(right.name));

export function listExtractorAdapters(): ExtractorAdapter[] {
  return ADAPTERS;
}

export function getExtractorAdapter(name: string): ExtractorAdapter {
  const adapter = ADAPTERS.find((item) => item.name === name);
  if (!adapter) {
    throw new Error(
      `Unsupported extractor "${name}". Supported extractors: ${ADAPTERS.map((item) => item.name).join(', ')}`,
    );
  }
  return adapter;
}

export function normalizeExtractorNames(
  values: string[] | undefined,
): ExtractorName[] {
  if (!values || values.length === 0) {
    return [];
  }

  const names: ExtractorName[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    for (const raw of value.split(/[\s,]+/)) {
      const name = raw.trim();
      if (!name || seen.has(name)) {
        continue;
      }
      const adapter = getExtractorAdapter(name);
      seen.add(adapter.name);
      names.push(adapter.name);
    }
  }
  return names;
}

export function installCommandForExtractors(packageNames: string[]): string {
  return `npm install -D ${packageNames.join(' ')}`;
}
