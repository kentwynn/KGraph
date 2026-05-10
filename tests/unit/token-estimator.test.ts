import { describe, expect, it } from 'vitest';
import { estimateTokens } from '../../src/session/token-estimator.js';

describe('token estimator', () => {
  it('estimates tokens from content length', () => {
    expect(estimateTokens('a'.repeat(400), 'src/app.ts')).toBe(100);
  });

  it('returns zero for empty content', () => {
    expect(estimateTokens('', 'README.md')).toBe(0);
  });
});
