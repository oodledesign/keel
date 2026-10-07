import { describe, expect, it } from 'vitest';

import {
  buildFormThemeCss,
  sanitizeFormCustomCss,
  validateFormCustomCss,
} from './form-custom-css';

describe('validateFormCustomCss', () => {
  it('accepts plain rules, declarations and @media', () => {
    expect(
      validateFormCustomCss(
        '.ozer-form-title { color: red; }\n@media (max-width: 600px) { input { font-size: 16px; } }',
      ),
    ).toBeNull();
    expect(validateFormCustomCss('color: #333;')).toBeNull();
    expect(validateFormCustomCss('')).toBeNull();
  });

  it.each([
    '@import "https://evil.example/x.css";',
    '.a { background: url(https://evil.example/p.png); }',
    '.a { background: URL( x ); }',
    '</style><script>alert(1)</script>',
    '.a { width: expression(alert(1)); }',
    '@font-face { font-family: x; }',
    '.a { content: "\\75rl(x)"; }',
    '.a { color: red;',
    '} .b { color: red;',
  ])('rejects %s', (css) => {
    expect(validateFormCustomCss(css)).not.toBeNull();
  });

  it('ignores banned text hidden inside comments only', () => {
    expect(validateFormCustomCss('/* url(x) */ .a { color: red; }')).toBeNull();
  });
});

describe('sanitizeFormCustomCss', () => {
  it('drops invalid css completely', () => {
    expect(sanitizeFormCustomCss('.a { background: url(x); }')).toBe('');
  });

  it('strips comments from valid css', () => {
    expect(sanitizeFormCustomCss('/* hi */ .a { color: red; }')).toBe(
      '.a { color: red; }',
    );
  });
});

describe('buildFormThemeCss', () => {
  it('is empty for default theme', () => {
    expect(
      buildFormThemeCss({
        fontFamily: 'default',
        cornerStyle: 'soft',
        customCss: '',
      }),
    ).toBe('');
  });

  it('nests custom css under the form root', () => {
    const css = buildFormThemeCss({
      fontFamily: 'serif',
      cornerStyle: 'sharp',
      customCss: '.ozer-form-title { color: red; }',
    });
    expect(css).toContain('Georgia');
    expect(css).toContain('border-radius: 0');
    expect(css).toContain(
      '.ozer-form-root {\n.ozer-form-title { color: red; }',
    );
  });
});
