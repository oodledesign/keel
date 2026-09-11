import { describe, expect, it } from 'vitest';

import {
  createCampaignBlock,
  createStarterDocument,
  importHtmlAsDocument,
  moveCampaignBlock,
  reorderCampaignBlocks,
  resolveCampaignDocument,
} from './campaign-document';
import {
  compileCampaignDocument,
  resolveCampaignSendHtml,
} from './compile-campaign-document';
import { applyCampaignMergeFields } from './merge-fields';

const brand = {
  primary_color: '#0D2344',
  secondary_color: '#FFFFFF',
  accent_color: '#57C87F',
  logo_url: 'https://cdn.example.com/logo.png',
  website_url: 'https://workspace.example.com',
};

describe('compileCampaignDocument', () => {
  it('compiles heading, text, button, and footer into table HTML', () => {
    const document = {
      version: 1 as const,
      blocks: [
        {
          id: 'h1',
          type: 'heading' as const,
          text: 'Hello {{first_name}}',
          level: 1 as const,
        },
        {
          id: 't1',
          type: 'text' as const,
          html: '<p>Welcome {{name}} at {{email}}</p>',
        },
        {
          id: 'b1',
          type: 'button' as const,
          label: 'Open {{first_name}}',
          href: 'https://example.com',
        },
        {
          id: 'f1',
          type: 'footer' as const,
          text: 'You subscribed to this list.',
        },
      ],
    };

    const html = compileCampaignDocument(document, brand);

    expect(html).toContain('ozer-campaign-document:v1');
    expect(html).toContain('role="presentation"');
    expect(html).toContain('width="600"');
    expect(html).toContain('Hello {{first_name}}');
    expect(html).toContain('Welcome {{name}} at {{email}}');
    expect(html).toContain('Open {{first_name}}');
    expect(html).toContain('https://example.com');
    expect(html).toContain('Unsubscribe');
    expect(html).toContain('{{unsubscribe_url}}');
    expect(html).not.toContain('display:flex');
    expect(html).not.toContain('display:grid');
  });

  it('applies merge fields after compile without losing the button or footer', () => {
    const document = {
      version: 1 as const,
      blocks: [
        {
          id: 'h1',
          type: 'heading' as const,
          text: 'Hi {{first_name}}',
          level: 2 as const,
        },
        {
          id: 't1',
          type: 'text' as const,
          html: '<p>{{name}} · {{email}}</p>',
        },
        {
          id: 'b1',
          type: 'button' as const,
          label: 'Hello {{name}}',
          href: 'https://example.com/go',
        },
        {
          id: 'f1',
          type: 'footer' as const,
          text: 'Footer copy',
        },
      ],
    };

    const compiled = compileCampaignDocument(document, brand, {
      unsubscribeUrl: 'https://example.com/unsub?token=abc',
    });
    const merged = applyCampaignMergeFields(compiled, {
      name: 'Ada Lovelace',
      firstName: 'Ada',
      email: 'ada@example.com',
    });

    expect(merged).toContain('Hi Ada');
    expect(merged).toContain('Ada Lovelace · ada@example.com');
    expect(merged).toContain('Hello Ada Lovelace');
    expect(merged).toContain('https://example.com/unsub?token=abc');
    expect(merged).not.toContain('{{first_name}}');
    expect(merged).not.toContain('{{name}}');
    expect(merged).not.toContain('{{email}}');
  });

  it('uses brand logo and colours on the starter document', () => {
    const html = compileCampaignDocument(createStarterDocument(brand), brand);

    expect(html).toContain('https://cdn.example.com/logo.png');
    expect(html).toContain('#0D2344');
    expect(html).toContain('#57C87F');
    expect(html).toContain('Unsubscribe');
  });

  it('escapes heading text while keeping merge tokens', () => {
    const html = compileCampaignDocument(
      {
        version: 1,
        blocks: [
          {
            id: 'h1',
            type: 'heading',
            text: 'Hi <script> {{first_name}}',
            level: 1,
          },
        ],
      },
      brand,
    );

    expect(html).toContain('Hi &lt;script&gt; {{first_name}}');
    expect(html).not.toContain('<script>');
  });

  it('imports legacy HTML as a single html block plus footer', () => {
    const imported = importHtmlAsDocument('<p>Old draft for {{name}}</p>');

    expect(imported.blocks[0]).toMatchObject({
      type: 'html',
      html: '<p>Old draft for {{name}}</p>',
    });
    expect(imported.blocks.some((block) => block.type === 'footer')).toBe(true);

    const html = compileCampaignDocument(imported, brand);
    expect(html).toContain('Old draft for {{name}}');
    expect(html).toContain('Unsubscribe');
  });

  it('turns empty or placeholder HTML into a branded starter', () => {
    const empty = resolveCampaignDocument(
      null,
      '<p>Write your email…</p>',
      brand,
    );

    expect(empty.blocks.map((block) => block.type)).toEqual([
      'logo',
      'heading',
      'text',
      'button',
      'footer',
    ]);
  });

  it('keeps bullet lists in compiled text blocks', () => {
    const html = compileCampaignDocument(
      {
        version: 1,
        blocks: [
          {
            id: 't-list',
            type: 'text',
            html: '<ul><li>Coffee</li><li>Tea</li></ul>',
          },
        ],
      },
      brand,
    );

    expect(html).toContain(
      '<ul style="margin:0 0 12px;padding-left:20px;list-style-type:disc;">',
    );
    expect(html).toContain('<li style="margin:0 0 4px;">Coffee</li>');
    expect(html).toContain('<li style="margin:0 0 4px;">Tea</li>');
  });

  it('appends an unsubscribe footer when the document has none', () => {
    const html = compileCampaignDocument(
      {
        version: 1,
        blocks: [createCampaignBlock('heading')],
      },
      brand,
    );

    expect(html).toContain('Unsubscribe');
    expect(html).toContain('{{unsubscribe_url}}');
  });

  it('keeps the footer last when reordering or moving blocks', () => {
    const document = createStarterDocument(brand);
    const heading = document.blocks.find((block) => block.type === 'heading');
    const footer = document.blocks.find((block) => block.type === 'footer');
    if (!heading || !footer) throw new Error('expected starter blocks');

    expect(
      reorderCampaignBlocks(document, footer.id, heading.id).blocks.map(
        (block) => block.type,
      ),
    ).toEqual(document.blocks.map((block) => block.type));

    expect(moveCampaignBlock(document, footer.id, -1).blocks.at(-1)?.type).toBe(
      'footer',
    );
  });

  it('uses the chosen brand logo variant with fallback', () => {
    const branded = {
      ...brand,
      logo_on_light_url: 'https://cdn.example.com/on-light.png',
      logo_on_dark_url: 'https://cdn.example.com/on-dark.png',
    };

    const dark = compileCampaignDocument(
      {
        version: 1,
        blocks: [{ id: 'logo', type: 'logo', logoVariant: 'on_dark' }],
      },
      branded,
    );
    expect(dark).toContain('https://cdn.example.com/on-dark.png');
    expect(dark).not.toContain('https://cdn.example.com/on-light.png');
    expect(dark).toMatch(
      /<td[^>]*width="100%"[^>]*bgcolor="#0D2344"[^>]*>[\s\S]*?<img src="https:\/\/cdn\.example\.com\/on-dark\.png"/,
    );

    const missing = compileCampaignDocument(
      {
        version: 1,
        blocks: [{ id: 'logo', type: 'logo', logoVariant: 'on_dark' }],
      },
      { ...brand, logo_on_dark_url: null },
    );
    expect(missing).toContain('https://cdn.example.com/logo.png');
  });

  it('persists block background and padding into compiled HTML', () => {
    const html = compileCampaignDocument(
      {
        version: 1,
        blocks: [
          {
            id: 'h1',
            type: 'heading',
            text: 'Padded heading',
            level: 2,
            backgroundColor: '#FFF4E8',
            padding: { top: 8, right: 16, bottom: 8, left: 16 },
          },
          {
            id: 'logo',
            type: 'logo',
            backgroundColor: 'transparent',
          },
        ],
      },
      brand,
    );

    expect(html).toContain('background:#FFF4E8');
    expect(html).toContain('background-color:#FFF4E8');
    expect(html).toContain('bgcolor="#FFF4E8"');
    expect(html).toContain('padding:8px 16px 8px 16px');
    expect(html).toContain('padding:20px 28px 20px 28px');
    expect(html).not.toMatch(/logo[\s\S]*background:#0D2344/);
  });

  it('emits light color-scheme, full-width logo plates, a durable divider, and Spark-safe type', () => {
    const branded = {
      ...brand,
      logo_on_light_url: 'https://cdn.example.com/on-light.png',
      logo_on_dark_url: 'https://cdn.example.com/on-dark.png',
    };

    const html = compileCampaignDocument(
      {
        version: 1,
        blocks: [
          { id: 'logo-primary', type: 'logo', logoVariant: 'primary' },
          { id: 'logo-light', type: 'logo', logoVariant: 'on_light' },
          { id: 'logo-dark', type: 'logo', logoVariant: 'on_dark' },
          { id: 'div', type: 'divider' },
          { id: 't1', type: 'text', html: '<p>Hello</p>' },
          { id: 'h1', type: 'heading', text: 'Title', level: 1 },
          { id: 'h2', type: 'heading', text: 'Section', level: 2 },
        ],
      },
      branded,
    );

    expect(html).toContain('name="color-scheme"');
    expect(html).toContain('name="supported-color-schemes"');
    expect(html).toContain('content="light only"');
    expect(html).toContain('class="ozer-email-body"');
    expect(html).toContain('bgcolor="#f4f1ec"');
    expect(html).toContain('background-color:#f4f1ec');
    expect(html).toContain('bgcolor="#FFFFFF"');
    expect(html).toContain('background-color:#FFFFFF');
    expect(html).toContain('bgcolor="#0D2344"');
    expect(html).toContain('background-color:#0D2344');
    expect(html).toContain('color:#333333');
    expect(html).toContain('-webkit-text-size-adjust:100%');
    expect(html).toContain('text-size-adjust:100%');
    expect(html).toContain('class="ozer-email-content"');
    expect(html).toContain('class="ozer-email-copy"');
    expect(html).toContain('font-size:20px');
    expect(html).toContain('font-size:32px');
    expect(html).toContain('font-size:26px');
    expect(html).toContain('font-size: 22px !important');
    expect(html).toContain('td.ozer-email-content');
    expect(html).toMatch(
      /<td[^>]*width="100%"[^>]*bgcolor="#0D2344"[^>]*>[\s\S]*?<img src="https:\/\/cdn\.example\.com\/logo\.png"/,
    );
    expect(html).toMatch(
      /<td[^>]*width="100%"[^>]*bgcolor="#FFFFFF"[^>]*>[\s\S]*?<img src="https:\/\/cdn\.example\.com\/on-light\.png"/,
    );
    expect(html).toMatch(
      /<td[^>]*bgcolor="#FFFFFF"[^>]*>\s*<img src="https:\/\/cdn\.example\.com\/on-light\.png"/,
    );
    expect(html).toMatch(
      /<td[^>]*bgcolor="#0D2344"[^>]*>\s*<img src="https:\/\/cdn\.example\.com\/on-dark\.png"/,
    );
    expect(html).toContain('height="4"');
    expect(html).toContain('height:4px');
    expect(html).toContain('bgcolor="#6B6560"');
    expect(html).toContain('background-color:#6B6560');
    expect(html).toContain('border-top:2px solid #6B6560');
    expect(html).toContain('mso-line-height-rule:exactly');
    expect(html).not.toContain('height="1"');
    expect(html).not.toContain('border-top:1px solid');
    expect(html).not.toContain('#B8AFA6');
    expect(html).not.toContain('#e4ddd6');
  });

  it('recompiles from body_document on send instead of stale html_body', () => {
    const document = {
      version: 1 as const,
      blocks: [
        { id: 't1', type: 'text' as const, html: '<p>Fresh compile</p>' },
        { id: 'div', type: 'divider' as const },
      ],
    };
    const stale =
      '<p>Old draft without dark-mode hardening</p><!-- ozer-campaign-document:v1 -->';

    const html = resolveCampaignSendHtml(document, brand, stale);

    expect(html).toContain('Fresh compile');
    expect(html).toContain('ozer-campaign-document:v1');
    expect(html).toContain('font-size:20px');
    expect(html).toContain('bgcolor="#6B6560"');
    expect(html).toContain('-webkit-text-size-adjust:100%');
    expect(html).not.toContain('Old draft without dark-mode hardening');
  });

  it('falls back to stored html_body when the document is empty', () => {
    const stale = '<p>Legacy HTML campaign</p>';

    expect(resolveCampaignSendHtml(null, brand, stale)).toBe(stale);
    expect(
      resolveCampaignSendHtml({ version: 1, blocks: [] }, brand, stale),
    ).toBe(stale);
  });

  it('lets an explicit logo background win over variant pairing', () => {
    const html = compileCampaignDocument(
      {
        version: 1,
        blocks: [
          {
            id: 'logo',
            type: 'logo',
            logoVariant: 'on_light',
            backgroundColor: '#351E28',
          },
        ],
      },
      brand,
    );

    expect(html).toContain('bgcolor="#351E28"');
    expect(html).toMatch(/<td[^>]*bgcolor="#351E28"[^>]*>\s*<img /);
  });

  it('renders image alignment, presets, and full width', () => {
    const html = compileCampaignDocument(
      {
        version: 1,
        blocks: [
          {
            id: 'img-full',
            type: 'image',
            src: 'https://cdn.example.com/hero.jpg',
            alt: 'Hero',
            size: 'full',
            align: 'center',
          },
          {
            id: 'img-custom',
            type: 'image',
            src: 'https://cdn.example.com/small.jpg',
            alt: 'Small',
            size: 'custom',
            width: 200,
            height: 80,
            align: 'right',
          },
        ],
      },
      brand,
    );

    expect(html).toContain('width="600"');
    expect(html).toContain('width:100%;max-width:600px');
    expect(html).toContain('padding:0px 0px 0px 0px');
    expect(html).toContain('width="200"');
    expect(html).toContain('height="80"');
    expect(html).toContain('align="right"');
  });
});
