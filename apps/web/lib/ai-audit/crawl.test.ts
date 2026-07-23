import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';

import { extractAllJsonLd } from './crawl';

describe('extractAllJsonLd', () => {
  it('reads schema.org @graph blocks from ld+json scripts', () => {
    const html = `<!doctype html><html><head>
      <script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'Organization', name: 'Tradeways' },
          { '@type': 'SoftwareApplication', name: 'Tradeways' },
          { '@type': 'FAQPage' },
        ],
      })}</script>
    </head><body><h1>Home</h1></body></html>`;

    const $ = load(html);
    const blocks = extractAllJsonLd($);
    expect(blocks.map((block) => block.type).sort()).toEqual([
      'FAQPage',
      'Organization',
      'SoftwareApplication',
    ]);
  });

  it('still finds JSON-LD when other scripts are present', () => {
    const html = `<!doctype html><html><head>
      <script>window.__BOOT__=1</script>
      <script type="application/ld+json">{"@type":"WebSite","name":"Demo"}</script>
    </head><body></body></html>`;

    const $ = load(html);
    expect(extractAllJsonLd($).map((block) => block.type)).toEqual(['WebSite']);
  });
});
