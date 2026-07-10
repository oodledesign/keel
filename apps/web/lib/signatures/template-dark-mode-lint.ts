export type SignatureTemplateLintSeverity = 'warn' | 'tip';

export type SignatureTemplateLintIssue = {
  id: string;
  severity: SignatureTemplateLintSeverity;
  title: string;
  detail: string;
};

const PURE_BLACK =
  /(?:^|[;\s"'])color\s*:\s*(?:#000(?:000)?|black|rgb\(\s*0\s*,\s*0\s*,\s*0\s*\)|rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*1\s*\))/i;
const PURE_WHITE =
  /(?:^|[;\s"'])color\s*:\s*(?:#fff(?:fff)?|white|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\)|rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*1\s*\))/i;
const SOLID_BG_DECL =
  /(?:background(?:-color)?\s*:\s*(?!transparent|none|inherit|initial|unset)([^;"']+)|bgcolor\s*=\s*["']?(?!transparent)([^"'\s>]+))/gi;
const LINK_TAG = /<a\b[^>]*>/gi;
const TEXT_DECORATION_NONE = /text-decoration\s*:\s*none/i;
const TEXT_DECORATION_UNDERLINE = /text-decoration\s*:\s*[^;]*underline/i;
const BUTTONISH_LINK =
  /<a\b[^>]*(?:style\s*=\s*["'][^"']*(?:background(?:-color)?\s*:\s*(?!transparent|none)[^;"']+)[^"']*["']|[^>]*bgcolor\s*=)/i;
const HAS_IMG = /<img\b/i;
const MID_GREY = /color\s*:\s*#333(?:333)?/i;
const TEMPLATE_TOKEN = /^\{\{\s*[\w.]+\s*\}\}$/;

function collectSolidBackgrounds(html: string) {
  const values: string[] = [];
  for (const match of html.matchAll(SOLID_BG_DECL)) {
    const value = (match[1] ?? match[2] ?? '').trim();
    if (value) {
      values.push(value);
    }
  }
  return values;
}

/**
 * Soft guards for Outlook / Gmail dark-mode resilience.
 * Never blocks save — only nudges authors toward safer patterns.
 */
export function lintSignatureTemplateHtml(
  html: string,
): SignatureTemplateLintIssue[] {
  const issues: SignatureTemplateLintIssue[] = [];
  const source = html.trim();

  if (!source) {
    return issues;
  }

  if (PURE_BLACK.test(source)) {
    issues.push({
      id: 'pure-black-text',
      severity: 'warn',
      title: 'Pure black text detected',
      detail:
        'Use a mid-grey like #333333 instead of #000. Dark-mode clients often invert pure black into pure white, which can look harsh or invisible against light accents.',
    });
  }

  const solidBackgrounds = collectSolidBackgrounds(source);
  const hasSolidBackground = solidBackgrounds.length > 0;
  const onlyTokenBackgrounds =
    hasSolidBackground &&
    solidBackgrounds.every((value) => TEMPLATE_TOKEN.test(value.trim()));

  if (hasSolidBackground) {
    issues.push({
      id: 'solid-background',
      severity: onlyTokenBackgrounds ? 'tip' : 'warn',
      title: onlyTokenBackgrounds
        ? 'Brand colour panel detected'
        : 'Solid background colour found',
      detail: onlyTokenBackgrounds
        ? 'Filled brand panels can invert poorly in dark mode. Preview both themes, and prefer transparent layouts when you can.'
        : 'Solid fills on tables, cells, or wrappers often invert poorly. Prefer transparent backgrounds and let the email client chrome show through.',
    });
  }

  if (PURE_WHITE.test(source)) {
    issues.push({
      id: 'pure-white-text',
      severity: hasSolidBackground ? 'tip' : 'warn',
      title: 'Pure white text detected',
      detail: hasSolidBackground
        ? 'White text on a coloured panel can become unreadable if the client inverts the fill. Prefer mid-greys on transparent layouts when possible.'
        : 'Avoid #ffffff text. Prefer mid-greys so inverted clients do not flip your copy into pure black on dark chrome.',
    });
  }

  const links = source.match(LINK_TAG) ?? [];
  const linksWithoutUnderline = links.filter(
    (tag) =>
      TEXT_DECORATION_NONE.test(tag) || !TEXT_DECORATION_UNDERLINE.test(tag),
  );

  if (links.length > 0 && linksWithoutUnderline.length > 0) {
    issues.push({
      id: 'links-not-underlined',
      severity: 'warn',
      title: 'Links may not stay visible when colours invert',
      detail:
        'Add text-decoration:underline to links. Underlines survive colour inversion better than colour alone.',
    });
  }

  if (BUTTONISH_LINK.test(source)) {
    issues.push({
      id: 'solid-cta-button',
      severity: 'warn',
      title: 'Solid CTA / button-style link detected',
      detail:
        'Filled buttons often become unreadable in dark mode. Prefer a simple underlined text link, or keep the fill very light and test both themes.',
    });
  }

  if (HAS_IMG.test(source)) {
    issues.push({
      id: 'logo-transparency',
      severity: 'tip',
      title: 'Use transparent logo assets',
      detail:
        'Export logos as PNG/SVG with a transparent background. White or black boxes behind logos show up badly when the inbox theme flips.',
    });
  }

  if (!MID_GREY.test(source)) {
    issues.push({
      id: 'prefer-mid-grey',
      severity: 'tip',
      title: 'Prefer mid-grey body text',
      detail:
        'Default body copy to color:#333333. It stays readable in light mode and usually survives dark-mode inversion better than pure black or white.',
    });
  }

  return issues;
}

export const SIGNATURE_DARK_MODE_CHECKLIST = [
  'Body text: mid-grey (#333333), not pure black or white',
  'Links: always underlined',
  'Backgrounds: transparent — avoid solid table/cell fills',
  'Logos: PNG/SVG with transparent background',
  'CTAs: prefer text links over solid buttons',
  'Preview both light and dark chrome before publishing',
] as const;
