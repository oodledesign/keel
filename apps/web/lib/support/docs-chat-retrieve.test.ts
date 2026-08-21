import { describe, expect, it } from 'vitest';

import { retrieveDocsChunks } from './docs-chat-retrieve';

describe('retrieveDocsChunks', () => {
  it('finds invoice-related docs for an invoicing question', () => {
    const chunks = retrieveDocsChunks('How do I create and send a client invoice?');
    expect(chunks.length).toBeGreaterThan(0);
    expect(
      chunks.some(
        (chunk) =>
          chunk.path.includes('invoic') ||
          chunk.title.toLowerCase().includes('invoice'),
      ),
    ).toBe(true);
    expect(chunks[0]?.url).toMatch(/\/work\/|docs/);
  });

  it('returns empty for stop-word-only queries', () => {
    expect(retrieveDocsChunks('the and or')).toEqual([]);
  });
});
