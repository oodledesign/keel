/**
 * Per-form branding CSS for the public form. Client-safe (no Node APIs).
 *
 * Custom CSS is authored by workspace members but served on a public page, so
 * it is restricted: no external resources (url(), @import, @font-face), no
 * script vectors, no markup. Everything is nested under `.ozer-form-root`
 * (native CSS nesting) so it cannot restyle anything outside the form.
 */
import {
  type WorkspaceFormCornerStyle,
  type WorkspaceFormFont,
  type WorkspaceFormTheme,
} from './form-theme';

export const FORM_ROOT_CLASS = 'ozer-form-root';

const FONT_STACKS: Record<WorkspaceFormFont, string | null> = {
  default: null,
  serif: 'Georgia, "Times New Roman", serif',
  rounded: '"Nunito", "Segoe UI", system-ui, -apple-system, sans-serif',
  mono: 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
};

const INPUT_SELECTOR = [
  'input:not([type=checkbox]):not([type=radio]):not([type=hidden])',
  'textarea',
  'select',
].join(', ');

const BANNED: Array<{ re: RegExp; message: string }> = [
  { re: /[<>]/, message: 'Custom CSS cannot contain "<" or ">".' },
  { re: /\\/, message: 'Custom CSS cannot contain backslash escapes.' },
  {
    re: /url\s*\(|image-set\s*\(|src\s*\(/i,
    message: 'External resources (url(), image-set()) are not allowed.',
  },
  {
    re: /expression\s*\(|javascript:|vbscript:|behavior\s*:|-moz-binding/i,
    message: 'That CSS is not allowed.',
  },
];

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Returns a human-readable problem, or null when the CSS is acceptable. */
export function validateFormCustomCss(raw: string): string | null {
  const css = stripComments(raw);
  if (!css.trim()) return null;

  for (const rule of BANNED) {
    if (rule.re.test(css)) return rule.message;
  }

  const atRules = css.match(/@[a-z-]+/gi) ?? [];
  if (atRules.some((rule) => rule.toLowerCase() !== '@media')) {
    return 'Only @media at-rules are allowed (no @import, @font-face, etc.).';
  }

  let depth = 0;
  for (const char of css) {
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth < 0) return 'Unbalanced braces in custom CSS.';
  }
  if (depth !== 0) return 'Unbalanced braces in custom CSS.';

  return null;
}

/** Defensive render-time sanitiser: invalid CSS is dropped entirely. */
export function sanitizeFormCustomCss(raw: string | null | undefined): string {
  if (!raw) return '';
  const css = stripComments(raw).trim();
  if (!css || validateFormCustomCss(css)) return '';
  return css;
}

function cornerCss(style: WorkspaceFormCornerStyle): string {
  if (style === 'sharp') {
    return `.${FORM_ROOT_CLASS} form, .${FORM_ROOT_CLASS} ${INPUT_SELECTOR.split(', ').join(`, .${FORM_ROOT_CLASS} `)}, .${FORM_ROOT_CLASS} button, .${FORM_ROOT_CLASS} .ozer-form-card { border-radius: 0 !important; }`;
  }
  if (style === 'round') {
    return `.${FORM_ROOT_CLASS} form, .${FORM_ROOT_CLASS} .ozer-form-card { border-radius: 28px !important; }
.${FORM_ROOT_CLASS} ${INPUT_SELECTOR.split(', ').join(`, .${FORM_ROOT_CLASS} `)} { border-radius: 18px !important; }
.${FORM_ROOT_CLASS} button { border-radius: 9999px !important; }`;
  }
  return '';
}

/** Full stylesheet for a form: generated theme rules + scoped custom CSS. */
export function buildFormThemeCss(
  theme: Pick<WorkspaceFormTheme, 'fontFamily' | 'cornerStyle' | 'customCss'>,
): string {
  const parts: string[] = [];
  const stack = FONT_STACKS[theme.fontFamily];
  if (stack) {
    parts.push(
      `.${FORM_ROOT_CLASS}, .${FORM_ROOT_CLASS} * { font-family: ${stack}; }`,
    );
  }
  const corners = cornerCss(theme.cornerStyle);
  if (corners) parts.push(corners);

  const custom = sanitizeFormCustomCss(theme.customCss);
  if (custom) parts.push(`.${FORM_ROOT_CLASS} {\n${custom}\n}`);

  return parts.join('\n');
}
