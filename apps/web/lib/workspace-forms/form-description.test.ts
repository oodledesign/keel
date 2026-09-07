import { describe, expect, it } from 'vitest';

import { formDescriptionToHtml } from './form-description';

describe('formDescriptionToHtml', () => {
  it('returns empty for blank input', () => {
    expect(formDescriptionToHtml(null)).toBe('');
    expect(formDescriptionToHtml('   ')).toBe('');
  });

  it('wraps plain text paragraphs and line breaks', () => {
    expect(formDescriptionToHtml('Hello\nthere\n\nNext')).toBe(
      '<p>Hello<br />there</p><p>Next</p>',
    );
  });

  it('keeps allowlisted rich text', () => {
    expect(
      formDescriptionToHtml(
        '<p>Join us at <a href="https://example.com">the venue</a>.</p>',
      ),
    ).toContain('href="https://example.com"');
  });

  it('strips unsafe tags from rich descriptions', () => {
    const html = formDescriptionToHtml(
      '<p>Hello</p><iframe src="https://evil.example"></iframe><script>alert(1)</script>',
    );
    expect(html).toContain('Hello');
    expect(html).not.toContain('iframe');
    expect(html).not.toContain('script');
  });
});
