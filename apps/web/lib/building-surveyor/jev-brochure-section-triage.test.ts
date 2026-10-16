import { describe, expect, it } from 'vitest';

import { splitBrochureChunks } from './jev-brochure-section-triage';

describe('splitBrochureChunks', () => {
  it('returns empty for blank text', () => {
    expect(splitBrochureChunks('')).toEqual([]);
    expect(splitBrochureChunks('   ')).toEqual([]);
  });

  it('splits on sentence boundaries and drops tiny crumbs', () => {
    const text =
      'The property sits on a quiet residential road near local shops. ' +
      'Short. ' +
      'The rear garden is mainly laid to lawn with a timber shed.';
    const chunks = splitBrochureChunks(text);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks.some((chunk) => chunk.includes('quiet residential'))).toBe(
      true,
    );
    expect(chunks.every((chunk) => chunk.length >= 40 || chunks.length === 1)).toBe(
      true,
    );
  });

  it('caps oversized text into slices', () => {
    const long = 'A'.repeat(3_000);
    const chunks = splitBrochureChunks(long);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 1_200)).toBe(true);
  });
});
