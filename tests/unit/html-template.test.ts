import { describe, expect, it } from 'vitest';
import { renderHtml } from '../../src/visualization/html-template.js';
import type { GraphData } from '../../src/visualization/graph-builder.js';

describe('visualization html template', () => {
  it('renders token estimate UI without changing graph purpose', () => {
    const html = renderHtml(
      {
        elements: [
          {
            data: {
              id: 'src/auth.ts',
              label: 'auth.ts',
              path: 'src/auth.ts',
              language: 'typescript',
              color: '#3b82f6',
              type: 'file',
              size: 512,
              tokenEstimate: 240,
              tokenBucket: 'medium',
              scanStatus: 'mapped',
            },
            classes: 'file typescript token-medium',
          },
        ],
        meta: {
          fileCount: 1,
          symbolCount: 0,
          cognitionCount: 0,
          tokenEstimate: 240,
          generatedAt: '2026-05-10T00:00:00.000Z',
        },
      } satisfies GraphData,
      '/tmp/repo',
    );

    expect(html).toContain('~240 tokens');
    expect(html).toContain('Estimated Tokens');
    expect(html).toContain('node.token-medium');
  });
});
