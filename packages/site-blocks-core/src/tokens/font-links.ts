/**
 * Build stylesheet URLs for Site Studio typography families.
 * Supports Fontshare (Cabinet Grotesk, General Sans, …) and Google Fonts.
 */

const FONTSHARE_SLUG: Record<string, string> = {
  'cabinet grotesk': 'cabinet-grotesk',
  'general sans': 'general-sans',
  satoshi: 'satoshi',
  'clash display': 'clash-display',
  'switzer': 'switzer',
};

function normalizeFamily(name: string) {
  return name.trim().toLowerCase();
}

function fontshareUrl(families: string[], weights: number[]) {
  const weightList = [...new Set(weights)].sort((a, b) => a - b).join(',');
  const params = families
    .map((family) => {
      const slug = FONTSHARE_SLUG[normalizeFamily(family)];
      return slug ? `f[]=${slug}@${weightList}` : null;
    })
    .filter(Boolean)
    .join('&');

  if (!params) return null;
  return `https://api.fontshare.com/v2/css?${params}&display=swap`;
}

function googleFontsUrl(families: string[], weights: number[]) {
  const weightList = [...new Set(weights)].sort((a, b) => a - b).join(';');
  const params = families
    .map((family) => {
      const encoded = encodeURIComponent(family.trim()).replace(/%20/g, '+');
      return `family=${encoded}:wght@${weightList}`;
    })
    .join('&');

  if (!params) return null;
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}

export function siteStudioFontStylesheetUrls(input: {
  displayFamily?: string;
  bodyFamily?: string;
  weights?: number[];
}): string[] {
  const weights = input.weights ?? [400, 500, 700];
  const uniqueFamilies = [
    ...new Set(
      [input.displayFamily, input.bodyFamily]
        .map((family) => family?.trim())
        .filter((family): family is string => Boolean(family)),
    ),
  ];

  if (uniqueFamilies.length === 0) return [];

  const fontshareFamilies = uniqueFamilies.filter(
    (family) => FONTSHARE_SLUG[normalizeFamily(family)],
  );
  const googleFamilies = uniqueFamilies.filter(
    (family) => !FONTSHARE_SLUG[normalizeFamily(family)],
  );

  return [
    fontshareUrl(fontshareFamilies, weights),
    googleFontsUrl(googleFamilies, weights),
  ].filter((url): url is string => Boolean(url));
}
