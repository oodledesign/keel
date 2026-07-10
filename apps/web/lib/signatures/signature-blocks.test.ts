import { describe, expect, it } from 'vitest';

import {
  createMinimalSignatureDocument,
  createSignatureBlock,
  htmlToSignatureBlocks,
  isSignatureBuilderHtml,
  signatureBlocksToHtml,
} from './signature-blocks';

describe('signatureBlocksToHtml / htmlToSignatureBlocks', () => {
  it('round-trips a minimal document', () => {
    const doc = createMinimalSignatureDocument();
    const html = signatureBlocksToHtml(doc);

    expect(isSignatureBuilderHtml(html)).toBe(true);

    const parsed = htmlToSignatureBlocks(html);
    expect(parsed).not.toBeNull();
    expect(parsed?.layout).toBe(doc.layout);
    expect(parsed?.blocks.map((block) => block.type)).toEqual(
      doc.blocks.map((block) => block.type),
    );
    expect(parsed?.blocks.map((block) => block.id)).toEqual(
      doc.blocks.map((block) => block.id),
    );
  });

  it('preserves custom text', () => {
    const doc = {
      version: 1 as const,
      layout: 'stacked' as const,
      blocks: [createSignatureBlock('custom_text', { text: 'Hello & welcome' })],
    };

    const parsed = htmlToSignatureBlocks(signatureBlocksToHtml(doc));
    expect(parsed?.blocks[0]?.text).toBe('Hello & welcome');
  });

  it('returns null for legacy HTML without builder markers', () => {
    expect(
      htmlToSignatureBlocks(
        `<table><tr><td style="color:#333">{{full_name}}</td></tr></table>`,
      ),
    ).toBeNull();
  });

  it('emits dark-mode friendly defaults', () => {
    const html = signatureBlocksToHtml(createMinimalSignatureDocument());
    expect(html).toContain('color:#333333');
    expect(html).toContain('text-decoration:underline');
    expect(html).not.toMatch(/background-color\s*:\s*#/i);
  });
});
