import type { ExtractorConfig, IntegrationConfig } from '../types/config.js';
import type { RepositoryFile } from '../types/maps.js';
import {
  extractorSetupCommands,
  integrationSetupCommand,
  type InitExtractorRecommendation,
  type InitIntegrationRecommendation,
} from './init-recommendations.js';

type CoverageLevel = 'deep' | 'basic' | 'generic';

export interface InitLanguageSummary {
  language: string;
  label: string;
  fileCount: number;
  coverage: CoverageLevel;
}

const LANGUAGE_PRESENTATION: Record<
  string,
  { label: string; coverage: CoverageLevel }
> = {
  javascript: { label: 'JavaScript', coverage: 'deep' },
  javascriptreact: { label: 'JavaScript', coverage: 'deep' },
  typescript: { label: 'TypeScript', coverage: 'deep' },
  typescriptreact: { label: 'TypeScript', coverage: 'deep' },
  python: { label: 'Python', coverage: 'basic' },
  go: { label: 'Go', coverage: 'basic' },
  rust: { label: 'Rust', coverage: 'basic' },
  java: { label: 'Java', coverage: 'basic' },
  kotlin: { label: 'Kotlin', coverage: 'basic' },
  c: { label: 'C', coverage: 'basic' },
  cpp: { label: 'C++', coverage: 'basic' },
  csharp: { label: 'C#', coverage: 'basic' },
  yaml: { label: 'YAML', coverage: 'generic' },
  json: { label: 'JSON', coverage: 'generic' },
  toml: { label: 'TOML', coverage: 'generic' },
  xml: { label: 'XML', coverage: 'generic' },
  graphql: { label: 'GraphQL', coverage: 'generic' },
  sql: { label: 'SQL', coverage: 'generic' },
  shell: { label: 'Shell', coverage: 'generic' },
};

const EXCLUDED_LANGUAGES = new Set(['unknown', 'markdown', 'restructuredtext']);

export function summarizeInitLanguages(
  files: RepositoryFile[],
): InitLanguageSummary[] {
  const byLabel = new Map<string, InitLanguageSummary>();

  for (const file of files) {
    if (EXCLUDED_LANGUAGES.has(file.language)) {
      continue;
    }

    const descriptor = describeLanguage(file.language);
    const existing = byLabel.get(descriptor.label);
    if (existing) {
      existing.fileCount += 1;
      existing.coverage = moreDetailedCoverage(
        existing.coverage,
        descriptor.coverage,
      );
      continue;
    }

    byLabel.set(descriptor.label, {
      language: file.language,
      label: descriptor.label,
      fileCount: 1,
      coverage: descriptor.coverage,
    });
  }

  return [...byLabel.values()].sort((left, right) => {
    if (right.fileCount !== left.fileCount) {
      return right.fileCount - left.fileCount;
    }
    return left.label.localeCompare(right.label);
  });
}

export function renderInitSummary(options: {
  files: RepositoryFile[];
  integrations: Pick<IntegrationConfig, 'name' | 'enabled' | 'mode'>[];
  recommendedIntegrations: InitIntegrationRecommendation[];
  extractors: Pick<ExtractorConfig, 'name' | 'enabled' | 'packageName'>[];
  recommendedExtractors: InitExtractorRecommendation[];
}): string {
  const languages = summarizeInitLanguages(options.files);
  const recommendedExtractorByLanguage = new Map<string, string>();
  for (const extractor of options.recommendedExtractors) {
    for (const language of extractor.languages) {
      recommendedExtractorByLanguage.set(language, extractor.name);
    }
  }
  const lines = ['KGraph Init Summary', ''];

  lines.push('AI integrations');
  if (options.recommendedIntegrations.length > 0) {
    lines.push(
      `  recommended: ${options.recommendedIntegrations.map((item) => `${item.name} (${item.reason})`).join('; ')}`,
    );
  }
  if (options.integrations.length === 0) {
    lines.push('  configured: none');
  } else {
    for (const integration of options.integrations) {
      lines.push(
        `  configured: ${integration.name}: ${integration.enabled ? integration.mode : 'off'}`,
      );
    }
  }

  lines.push('');
  lines.push('Repo languages');
  if (languages.length === 0) {
    lines.push('  none detected yet');
  } else {
    for (const language of languages) {
      const recommendedExtractor = recommendedExtractorByLanguage.get(
        language.language,
      );
      lines.push(
        `  ${language.label}: ${formatFileCount(language.fileCount)}, ${coverageDescription(language.coverage)}${recommendedExtractor ? `; recommended extractor: ${recommendedExtractor}` : ''}`,
      );
    }
  }

  lines.push('');
  lines.push('Optional extractors');
  if (options.extractors.length === 0) {
    lines.push('  configured: none');
  } else {
    for (const extractor of options.extractors) {
      lines.push(
        `  configured: ${extractor.name}: ${extractor.enabled ? extractor.packageName : 'off'}`,
      );
    }
  }
  if (options.recommendedExtractors.length > 0) {
    for (const extractor of options.recommendedExtractors) {
      lines.push(
        `  recommended: ${extractor.name} for ${extractor.languages.map(humanizeLanguage).join(', ')} (${extractor.packageName})`,
      );
    }
  }

  lines.push('');
  lines.push('Next');
  lines.push('  kgraph "topic"  Run the normal refresh and context workflow');
  const integrationCommand = integrationSetupCommand(
    options.recommendedIntegrations,
  );
  if (integrationCommand) {
    lines.push(`  ${integrationCommand}  Optional: connect detected AI tools`);
  } else if (options.integrations.length === 0) {
    lines.push('  kgraph integrate add <agent>  Optional: connect an AI tool');
  }
  for (const command of extractorSetupCommands(options.recommendedExtractors)) {
    lines.push(`  ${command}`);
  }
  lines.push('  kgraph doctor  Check workspace health');

  return lines.join('\n');
}

function describeLanguage(language: string): {
  label: string;
  coverage: CoverageLevel;
} {
  return (
    LANGUAGE_PRESENTATION[language] ?? {
      label: humanizeLanguage(language),
      coverage: 'generic',
    }
  );
}

function humanizeLanguage(language: string): string {
  return language
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function moreDetailedCoverage(
  left: CoverageLevel,
  right: CoverageLevel,
): CoverageLevel {
  const rank: Record<CoverageLevel, number> = {
    deep: 3,
    basic: 2,
    generic: 1,
  };
  return rank[left] >= rank[right] ? left : right;
}

function coverageDescription(coverage: CoverageLevel): string {
  switch (coverage) {
    case 'deep':
      return 'deep built-in extraction';
    case 'basic':
      return 'basic built-in extraction';
    default:
      return 'generic file coverage';
  }
}

function formatFileCount(fileCount: number): string {
  return fileCount === 1 ? '1 file' : `${fileCount} files`;
}
