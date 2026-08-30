import { describe, expect, it } from 'vitest';

import {
  createCampaignBlock,
  createStarterDocument,
  importHtmlAsDocument,
  moveCampaignBlock,
  reorderCampaignBlocks,
  resolveCampaignDocument,
} from './campaign-document';
import { compileCampaignDocument } from './compile-campaign-document';
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
});
