import { describe, expect, it } from 'vitest';

import {
  buildIframeEmbedSnippet,
  buildScriptEmbedSnippet,
  renderFeedflowEmbedHtml,
} from './embed';

describe('embed snippets', () => {
  it('builds a pasteable iframe pointing at the public embed route', () => {
    const snippet = buildIframeEmbedSnippet(
      'https://app.ozer.so',
      'abc_embed_key_123456789',
    );

    expect(snippet).toContain(
      'https://app.ozer.so/api/feedflow/embed?widget=abc_embed_key_123456789',
    );
    expect(snippet).toContain('<iframe');
    expect(snippet).toContain('IntersectionObserver');
  });

  it('builds a script tag plus mount node', () => {
    const snippet = buildScriptEmbedSnippet(
      'https://app.ozer.so',
      'abc_embed_key_123456789',
    );

    expect(snippet).toContain('data-feedflow-widget="abc_embed_key_123456789"');
    expect(snippet).toContain(
      'https://app.ozer.so/api/feedflow/embed/script?widget=abc_embed_key_123456789',
    );
  });
});

describe('renderFeedflowEmbedHtml', () => {
  it('renders a grid that links to Instagram permalinks and honors captions', () => {
    const html = renderFeedflowEmbedHtml({
      embedKey: 'widgetkey12345678',
      config: {
        columns_desktop: 3,
        columns_tablet: 2,
        columns_mobile: 1,
        post_count: 9,
        show_captions: true,
        show_likes: true,
        play_videos: true,
        tile_ratio: 'portrait',
        reveal_animation: 'cascade',
        gap: 12,
        border_radius: 8,
        accent_colour: '#FF5C34',
        custom_css: null,
        open_in: 'instagram',
        layout: 'grid',
      },
      posts: [
        {
          id: '1',
          media_url: 'https://cdn.example/one.jpg',
          thumbnail_url: 'https://cdn.example/one.jpg',
          caption: 'Hello <script>alert(1)</script>',
          permalink: 'https://www.instagram.com/p/abc/',
          timestamp: '2026-08-01T00:00:00.000Z',
          media_type: 'IMAGE',
          like_count: 1200,
          comment_count: 8,
        },
      ],
    });

    expect(html).toContain('aspect-ratio: 4 / 5');
    expect(html).toContain('ff-reveal-cascade');
    expect(html).toContain('--ff-i:0');
    expect(html).toContain('1.2k');
    expect(html).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(html).toContain('https://www.instagram.com/p/abc/');
    expect(html).toContain('Hello &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('#FF5C34');
  });
});
