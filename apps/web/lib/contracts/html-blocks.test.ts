import { describe, expect, it } from 'vitest';

import {
  decodeHtmlEntities,
  htmlToBlocks,
  runsToPlainText,
} from './html-blocks';

describe('decodeHtmlEntities', () => {
  it('decodes named and numeric entities', () => {
    expect(decodeHtmlEntities('A&nbsp;&amp;&lt;B&#39;')).toBe("A &<B'");
    expect(decodeHtmlEntities('&#x2014;')).toBe('\u2014');
  });
});

describe('htmlToBlocks', () => {
  it('returns an empty list for blank HTML', () => {
    expect(htmlToBlocks('')).toEqual([]);
    expect(htmlToBlocks('   ')).toEqual([]);
  });

  it('parses headings, paragraphs, bold and italic', () => {
    const blocks = htmlToBlocks(
      '<h1>Title</h1><p>Hello <strong>world</strong> and <em>friends</em></p>',
    );
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: 'heading', level: 1 });
    if (blocks[0]?.type !== 'heading') throw new Error('expected heading');
    expect(runsToPlainText(blocks[0].runs)).toBe('Title');
    expect(blocks[1]?.type).toBe('paragraph');
    if (blocks[1]?.type !== 'paragraph') throw new Error('expected paragraph');
    expect(runsToPlainText(blocks[1].runs)).toBe('Hello world and friends');
    expect(blocks[1].runs.find((run) => run.text === 'world')?.bold).toBe(true);
    expect(blocks[1].runs.find((run) => run.text === 'friends')?.italic).toBe(
      true,
    );
  });

  it('parses unordered and ordered lists', () => {
    const blocks = htmlToBlocks(
      '<ul><li>One</li><li><b>Two</b></li></ul><ol><li>First</li></ol>',
    );
    expect(blocks[0]).toMatchObject({ type: 'list', ordered: false });
    expect(blocks[1]).toMatchObject({ type: 'list', ordered: true });
    if (blocks[0]?.type !== 'list' || blocks[1]?.type !== 'list') {
      throw new Error('expected lists');
    }
    expect(runsToPlainText(blocks[0].items[0]!)).toBe('One');
    expect(blocks[0].items[1]![0]?.bold).toBe(true);
    expect(runsToPlainText(blocks[1].items[0]!)).toBe('First');
  });

  it('parses links', () => {
    const blocks = htmlToBlocks(
      '<p>See <a href="https://example.com">the site</a></p>',
    );
    if (blocks[0]?.type !== 'paragraph') throw new Error('expected paragraph');
    const link = blocks[0].runs.find((run) => run.href);
    expect(link?.text).toBe('the site');
    expect(link?.href).toBe('https://example.com');
  });

  it('ignores javascript: links', () => {
    const blocks = htmlToBlocks(
      '<p><a href="javascript:alert(1)">nope</a></p>',
    );
    if (blocks[0]?.type !== 'paragraph') throw new Error('expected paragraph');
    expect(blocks[0].runs.some((run) => run.href)).toBe(false);
    expect(runsToPlainText(blocks[0].runs)).toBe('nope');
  });

  it('parses tables', () => {
    const blocks = htmlToBlocks(
      '<table><tr><th>Item</th><th>Qty</th></tr><tr><td>Fee</td><td>1</td></tr></table>',
    );
    expect(blocks[0]?.type).toBe('table');
    if (blocks[0]?.type !== 'table') throw new Error('expected table');
    expect(blocks[0].rows).toHaveLength(2);
    expect(runsToPlainText(blocks[0].rows[0]![0]!)).toBe('Item');
    expect(blocks[0].rows[0]![0]![0]?.bold).toBe(true);
    expect(runsToPlainText(blocks[0].rows[1]![1]!)).toBe('1');
  });

  it('preserves line breaks inside a paragraph', () => {
    const blocks = htmlToBlocks('<p>Line one<br>Line two</p>');
    if (blocks[0]?.type !== 'paragraph') throw new Error('expected paragraph');
    expect(runsToPlainText(blocks[0].runs)).toBe('Line one\nLine two');
  });
});
