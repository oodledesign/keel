import { describe, expect, it } from 'vitest';

import {
  noteMarkdownToHtml,
  noteMarkdownToPlainText,
  parseNoteMarkdown,
} from './note-markdown';

const sample = `# Title
## Me
Hello **bold** and *italic* and <u>under</u>
- one
- two **items**
## Speaker 1
How are you`;

describe('parseNoteMarkdown', () => {
  it('keeps speaker H2 headings and inline marks', () => {
    const blocks = parseNoteMarkdown(sample);

    expect(blocks.map((block) => [block.kind, block.runs.map((run) => run.text).join('')])).toEqual([
      ['heading1', 'Title'],
      ['heading2', 'Me'],
      ['paragraph', 'Hello bold and italic and under'],
      ['bullet', 'one'],
      ['bullet', 'two items'],
      ['heading2', 'Speaker 1'],
      ['paragraph', 'How are you'],
    ]);

    const paragraph = blocks[2]!;
    expect(paragraph.runs.some((run) => run.bold && run.text === 'bold')).toBe(true);
    expect(paragraph.runs.some((run) => run.italic && run.text === 'italic')).toBe(true);
    expect(paragraph.runs.some((run) => run.underline && run.text === 'under')).toBe(true);
  });

  it('parses nested underline and bold', () => {
    const blocks = parseNoteMarkdown('<u>**loud**</u>');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.runs).toEqual([
      { text: 'loud', bold: true, italic: false, underline: true },
    ]);
  });

  it('does not treat mid-word underscores as italic', () => {
    const blocks = parseNoteMarkdown('hello_world');
    expect(blocks[0]!.runs).toEqual([
      { text: 'hello_world', bold: false, italic: false, underline: false },
    ]);
  });
});

describe('noteMarkdownToHtml', () => {
  it('renders headings, marks, and bullets without raw markers', () => {
    const html = noteMarkdownToHtml(sample);

    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<h2>Me</h2>');
    expect(html).toContain('<h2>Speaker 1</h2>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<u>under</u>');
    expect(html).toContain('<ul><li>one</li><li>two <strong>items</strong></li></ul>');
    expect(html).not.toContain('**');
    expect(html).not.toContain('##');
    expect(html).not.toContain('- one');
  });

  it('escapes HTML in note text', () => {
    expect(noteMarkdownToHtml('Use <script>alert(1)</script>')).toBe(
      '<p>Use &lt;script&gt;alert(1)&lt;/script&gt;</p>',
    );
  });

  it('returns an empty string for blank markdown', () => {
    expect(noteMarkdownToHtml('   \n\n')).toBe('');
  });
});

describe('noteMarkdownToPlainText', () => {
  it('strips markers for list previews', () => {
    expect(noteMarkdownToPlainText('# Title\n**bold**')).toBe('Title\nbold');
    expect(noteMarkdownToPlainText('## Me\nHello **there**')).toBe('Me\nHello there');
  });
});
