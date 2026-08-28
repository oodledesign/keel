import { describe, expect, it } from 'vitest';

import {
  createMinimalSignatureDocument,
  createSignatureBlock,
  htmlToSignatureBlocks,
  isSignatureBuilderHtml,
  paletteForBackground,
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
    expect(parsed?.background?.mode).toBe('none');
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
      blocks: [
        createSignatureBlock('custom_text', { text: 'Hello & welcome' }),
      ],
    };

    const parsed = htmlToSignatureBlocks(signatureBlocksToHtml(doc));
    expect(parsed?.blocks[0]?.text).toBe('Hello & welcome');
  });

  it('puts credentials on the name line when enabled', () => {
    const doc = {
      version: 1 as const,
      layout: 'stacked' as const,
      blocks: [createSignatureBlock('name', { includeCredentials: true })],
    };

    const html = signatureBlocksToHtml(doc);
    expect(html).toContain('include_credentials="1"');
    expect(html).toMatch(
      /\{\{full_name\}\}<span style="font-weight:400;"> \{\{credentials\}\}<\/span>/,
    );

    const parsed = htmlToSignatureBlocks(html);
    expect(parsed?.blocks).toHaveLength(1);
    expect(parsed?.blocks[0]).toMatchObject({
      type: 'name',
      includeCredentials: true,
    });
  });

  it('folds a legacy credentials block into the name checkbox', () => {
    const name = createSignatureBlock('name');
    const credentials = createSignatureBlock('credentials');
    const html = [
      `<!-- ozer-sig-builder:v1 layout="stacked" -->`,
      `<!-- /ozer-sig-builder -->`,
      `<!-- ozer-block id="${name.id}" type="name" -->`,
      `<!-- /ozer-block -->`,
      `<!-- ozer-block id="${credentials.id}" type="credentials" -->`,
      `<!-- /ozer-block -->`,
    ].join('\n');

    const parsed = htmlToSignatureBlocks(html);
    expect(parsed?.blocks.map((block) => block.type)).toEqual(['name']);
    expect(parsed?.blocks[0]?.includeCredentials).toBe(true);
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

  it('round-trips a solid background and forces canvas colours', () => {
    const doc = {
      ...createMinimalSignatureDocument(),
      background: { mode: 'solid' as const, color: '#2A1720' },
    };
    const html = signatureBlocksToHtml(doc);
    const palette = paletteForBackground(doc.background);

    expect(html).toContain('bg="solid:#2A1720"');
    expect(html).toContain('bgcolor="#2A1720"');
    expect(html).toContain('background-color:#2A1720');
    expect(html).toContain('color-scheme:light only');
    expect(html).toContain(`color:${palette.primary}`);
    // Padding on cells (not the table) — mail clients ignore table padding.
    expect(html).toMatch(/padding:16px 8px 16px 16px/);
    expect(html).toMatch(/padding:16px 20px 16px 0/);

    const parsed = htmlToSignatureBlocks(html);
    expect(parsed?.background).toEqual({
      mode: 'solid',
      color: '#2A1720',
    });
  });

  it('round-trips a gradient background', () => {
    const doc = {
      ...createMinimalSignatureDocument(),
      background: {
        mode: 'gradient' as const,
        color: '#FF5C34',
        colorEnd: '#2A1720',
      },
    };
    const html = signatureBlocksToHtml(doc);

    expect(html).toContain('bg="gradient:#FF5C34:#2A1720"');
    expect(html).toContain(
      'background-image:linear-gradient(135deg,#FF5C34,#2A1720)',
    );

    const parsed = htmlToSignatureBlocks(html);
    expect(parsed?.background).toEqual({
      mode: 'gradient',
      color: '#FF5C34',
      colorEnd: '#2A1720',
    });
  });

  it('round-trips contact icons and emits icon image markup', () => {
    const doc = {
      ...createMinimalSignatureDocument(),
      showContactIcons: true as const,
      blocks: [
        createSignatureBlock('email'),
        createSignatureBlock('phone_direct'),
        createSignatureBlock('phone_mobile'),
        createSignatureBlock('website'),
        createSignatureBlock('address'),
      ],
    };
    const html = signatureBlocksToHtml(doc);

    expect(html).toContain('icons="1"');
    expect(html).toContain('/brand/signature-icons/email.png');
    expect(html).toContain('/brand/signature-icons/phone.png');
    expect(html).toContain('/brand/signature-icons/mobile.png');
    expect(html).toContain('/brand/signature-icons/website.png');
    expect(html).toContain('/brand/signature-icons/address.png');

    const parsed = htmlToSignatureBlocks(html);
    expect(parsed?.showContactIcons).toBe(true);
  });

  it('omits contact icons by default', () => {
    const html = signatureBlocksToHtml(createMinimalSignatureDocument());
    expect(html).not.toContain('icons="1"');
    expect(html).not.toContain('/brand/signature-icons/');
    expect(htmlToSignatureBlocks(html)?.showContactIcons).toBeUndefined();
  });

  it('uses light contact icons on a dark canvas', () => {
    const html = signatureBlocksToHtml({
      ...createMinimalSignatureDocument(),
      showContactIcons: true,
      background: { mode: 'solid', color: '#2A1720' },
      blocks: [createSignatureBlock('email')],
    });
    expect(html).toContain('/brand/signature-icons/email-light.png');
  });

  it('round-trips photo badge off', () => {
    const html = signatureBlocksToHtml({
      ...createMinimalSignatureDocument(),
      showPhotoBadge: false,
    });
    expect(html).toContain('photo_badge="0"');
    expect(html).not.toContain('{{company_icon_badge_url}}');
    expect(htmlToSignatureBlocks(html)?.showPhotoBadge).toBe(false);
  });

  it('prefixes icon URLs with NEXT_PUBLIC_SITE_URL when set', () => {
    const original = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = 'https://app.example.com';
    try {
      const html = signatureBlocksToHtml({
        ...createMinimalSignatureDocument(),
        showContactIcons: true,
        blocks: [createSignatureBlock('email')],
      });
      expect(html).toContain(
        'https://app.example.com/brand/signature-icons/email.png',
      );
    } finally {
      if (original === undefined) {
        delete process.env.NEXT_PUBLIC_SITE_URL;
      } else {
        process.env.NEXT_PUBLIC_SITE_URL = original;
      }
    }
  });

  it('parses icons attr regardless of order relative to bg', () => {
    const name = createSignatureBlock('email');
    const html = [
      `<!-- ozer-sig-builder:v1 layout="stacked" icons="1" bg="solid:#2A1720" -->`,
      `<!-- /ozer-sig-builder -->`,
      `<!-- ozer-block id="${name.id}" type="email" -->`,
      `<!-- /ozer-block -->`,
    ].join('\n');

    const parsed = htmlToSignatureBlocks(html);
    expect(parsed?.showContactIcons).toBe(true);
    expect(parsed?.background).toEqual({
      mode: 'solid',
      color: '#2A1720',
    });
  });

  it('emits company logo and photo badge tokens from the visual builder', () => {
    const doc = {
      ...createMinimalSignatureDocument(),
      blocks: [createSignatureBlock('photo'), createSignatureBlock('logo')],
    };
    const html = signatureBlocksToHtml(doc);

    expect(html).toContain('{{company_logo_url}}');
    expect(html).toContain('{{company_icon_badge_url}}');
    expect(html).toContain('{{photo_url}}');
  });
});
