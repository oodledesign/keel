import { describe, expect, it } from 'vitest';

import {
  formatExtractInstructionsBlock,
  normalizeExtractInstructions,
} from './extract-instructions';

describe('extract instructions', () => {
  it('returns null for empty input', () => {
    expect(normalizeExtractInstructions('')).toBeNull();
    expect(normalizeExtractInstructions('   ')).toBeNull();
    expect(formatExtractInstructionsBlock('')).toBe('');
  });

  it('formats a prompt block for the model', () => {
    const block = formatExtractInstructionsBlock(
      'Combine all Tim email bullets into one task.',
    );

    expect(block).toContain('User instructions');
    expect(block).toContain('Combine all Tim email bullets into one task.');
  });
});
