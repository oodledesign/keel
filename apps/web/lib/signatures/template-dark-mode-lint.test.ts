import { describe, expect, it } from 'vitest';

import { lintSignatureTemplateHtml } from './template-dark-mode-lint';

describe('lintSignatureTemplateHtml', () => {
  it('flags pure black and solid backgrounds', () => {
    const issues = lintSignatureTemplateHtml(
      `<table style="background-color:#ffffff"><td style="color:#000000">Hi</td></table>`,
    );

    expect(issues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining(['pure-black-text', 'solid-background']),
    );
  });

  it('flags links without underline', () => {
    const issues = lintSignatureTemplateHtml(
      `<a href="https://example.com" style="color:#333333">Site</a>`,
    );

    expect(issues.some((issue) => issue.id === 'links-not-underlined')).toBe(
      true,
    );
  });

  it('passes a resilient snippet', () => {
    const issues = lintSignatureTemplateHtml(
      `<table><tr><td style="color:#333333"><a href="https://example.com" style="color:#333333;text-decoration:underline">Site</a></td></tr></table>`,
    );

    const warnings = issues.filter((issue) => issue.severity === 'warn');
    expect(warnings).toHaveLength(0);
  });

  it('treats token brand panels as tips, not hard warnings', () => {
    const issues = lintSignatureTemplateHtml(
      `<td style="background-color:{{brand_primary_color}};color:#FFFFFF"><a href="mailto:a@b.com" style="color:#FFFFFF;text-decoration:underline;">a@b.com</a></td>`,
    );

    const warnings = issues.filter((issue) => issue.severity === 'warn');
    expect(warnings).toHaveLength(0);
    expect(issues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining(['solid-background', 'pure-white-text']),
    );
  });
});
