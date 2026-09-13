/**
 * Incremental import polish: URL canonicalisation, title/ingredient/step
 * cleanup, servings heuristics, and review warnings. Pure helpers — no fetch.
 */

const TRACKING_PARAMS =
  /^(utm_|igsh|igshid|fbclid|gclid|mc_|si$|feature$|ref$|s$)/i;

const JUNK_LINE =
  /^(advertisement|sponsored|shop (the )?(ingredients|recipe)|jump to (recipe|video|content)|print( recipe)?|save( recipe)?|rate this|nutrition( facts)?|you may also (like|enjoy)|related recipes|subscribe( now)?|sign up|cookie(s)? (policy|settings)|skip to content)$/i;

const SITE_TITLE_SUFFIX =
  /\s*[|–—-]\s*(bbc(\s+good\s+food)?|nyt(\s+cooking)?|new york times|serious eats|delicious|guardian|food52|bon app[eé]tit|allrecipes|tasty|jamie oliver|recipe(s)?)\s*$/i;

export function canonicalizeSourceUrl(raw: string): string {
  try {
    const parsed = new URL(
      /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`,
    );
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return raw.trim();
    }

    parsed.hash = '';
    parsed.hostname = parsed.hostname.toLowerCase();

    const drop: string[] = [];
    parsed.searchParams.forEach((_, key) => {
      if (TRACKING_PARAMS.test(key)) drop.push(key);
    });
    for (const key of drop) parsed.searchParams.delete(key);

    const instagram = canonicalInstagramPath(parsed);
    if (instagram) return instagram;

    let path = parsed.pathname.replace(/\/{2,}/g, '/');
    if (path.length > 1) path = path.replace(/\/+$/, '');
    parsed.pathname = path || '/';

    return parsed.href;
  } catch {
    return raw.trim();
  }
}

export function sourceUrlFingerprint(raw: string | null | undefined): string {
  if (!raw?.trim()) return '';
  const canonical = canonicalizeSourceUrl(raw).toLowerCase().replace(/\/$/, '');
  return canonical.replace(/^(https?:\/\/)www\./, '$1');
}

export function sourceUrlsMatch(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const a = sourceUrlFingerprint(left);
  const b = sourceUrlFingerprint(right);
  return Boolean(a && b && a === b);
}

export function isInstagramHost(url: string): boolean {
  try {
    const host = new URL(
      /^https?:\/\//i.test(url) ? url : `https://${url}`,
    ).hostname
      .replace(/^www\./, '')
      .toLowerCase();
    return host === 'instagram.com' || host === 'instagr.am';
  } catch {
    return false;
  }
}

function canonicalInstagramPath(parsed: URL): string | null {
  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
  if (host !== 'instagram.com' && host !== 'instagr.am') return null;

  const path = parsed.pathname.replace(/\/+$/, '');
  const shareReel = /^\/share\/reel\/([^/]+)/i.exec(path);
  const sharePost = /^\/share\/p\/([^/]+)/i.exec(path);
  const reels = /^\/reels\/([^/]+)/i.exec(path);
  const reel = /^\/reel\/([^/]+)/i.exec(path);
  const post = /^\/p\/([^/]+)/i.exec(path);
  const tv = /^\/tv\/([^/]+)/i.exec(path);

  const id =
    shareReel?.[1] ??
    sharePost?.[1] ??
    reels?.[1] ??
    reel?.[1] ??
    post?.[1] ??
    tv?.[1];
  if (!id) return null;

  const kind = sharePost || post ? 'p' : tv ? 'tv' : 'reel';
  return `https://www.instagram.com/${kind}/${id}/`;
}

export function isInstagramRecipePath(url: string): boolean {
  try {
    const parsed = new URL(
      /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`,
    );
    if (!isInstagramHost(parsed.href)) return false;
    return /\/(p|reel|reels|tv|share\/(?:p|reel))\//i.test(parsed.pathname);
  } catch {
    return false;
  }
}

export function parseServingsValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.min(50, Math.round(value));
  }
  if (typeof value !== 'string' || !value.trim()) return null;

  const range = value.match(/(\d+)\s*(?:-|–|—|to)\s*\d+/i);
  if (range?.[1]) {
    const n = Number.parseInt(range[1], 10);
    if (Number.isFinite(n) && n > 0) return Math.min(50, n);
  }

  const match = value.match(/(\d+)/);
  if (match?.[1]) {
    const n = Number.parseInt(match[1], 10);
    if (Number.isFinite(n) && n > 0) return Math.min(50, n);
  }
  return null;
}

export function cleanRecipeTitle(
  name: string,
  siteLabel?: string | null,
): string {
  let cleaned = name.replace(/\s+/g, ' ').trim();
  cleaned = cleaned.replace(/^recipe:\s*/i, '');
  cleaned = cleaned.replace(SITE_TITLE_SUFFIX, '');
  if (siteLabel?.trim()) {
    const escaped = siteLabel.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleaned = cleaned.replace(
      new RegExp(`\\s*[|–—-]\\s*${escaped}\\s*$`, 'i'),
      '',
    );
  }
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return (cleaned || name).slice(0, 160);
}

export function isJunkRecipeLine(line: string): boolean {
  return JUNK_LINE.test(line.trim());
}

function looksLikeIngredient(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || isJunkRecipeLine(trimmed)) return false;
  if (trimmed.length > 180) return false;
  return (
    /^\d/.test(trimmed) ||
    /^(a |an |the |few |some |pinch|handful|knob|splash)/i.test(trimmed) ||
    /\b(g|kg|ml|l|tsp|tbsp|cup|cups|oz|lb|clove|cloves)\b/i.test(trimmed) ||
    trimmed.split(/\s+/).length <= 8
  );
}

export function tidyIngredientLines(lines: string[]): string[] {
  const expanded: string[] = [];
  for (const raw of lines) {
    const trimmed = raw.replace(/\s+/g, ' ').trim();
    if (!trimmed) continue;
    const pieces = trimmed
      .split(/\s*[•|]\s+|\s+;\s+/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (
      pieces.length > 1 &&
      pieces.every((piece) => looksLikeIngredient(piece))
    ) {
      expanded.push(...pieces);
      continue;
    }
    expanded.push(trimmed);
  }

  const merged: string[] = [];
  for (const line of expanded) {
    const trimmed = line.replace(/\s+/g, ' ').trim();
    if (!trimmed || isJunkRecipeLine(trimmed)) continue;

    const previous = merged[merged.length - 1];
    if (
      previous &&
      /^[a-z]/.test(trimmed) &&
      !looksLikeIngredient(trimmed) &&
      previous.length < 80
    ) {
      merged[merged.length - 1] = `${previous} ${trimmed}`;
      continue;
    }
    merged.push(trimmed.slice(0, 200));
  }

  const seen = new Set<string>();
  return merged.filter((line) => {
    const key = line.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function tidyInstructionText(
  text: string | null | undefined,
): string | null {
  if (!text?.trim()) return null;

  const chunks = text
    .split(/\n+/)
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter((line) => line && !isJunkRecipeLine(line));

  if (chunks.length === 0) return null;

  return chunks
    .map((line, index) => `${index + 1}. ${line.slice(0, 1_200)}`)
    .join('\n')
    .slice(0, 8_000);
}

export function looksLikePaywalledHtml(html: string): boolean {
  const sample = html.slice(0, 80_000).toLowerCase();
  return (
    /subscribe to (continue|read|view)/.test(sample) ||
    /create a free account to (continue|read)/.test(sample) ||
    /sign in to continue/.test(sample) ||
    /you.?ve reached your (article|recipe) limit/.test(sample) ||
    /metered.?paywall|tp-modal|piano-id|offerwall/.test(sample) ||
    /id=["']paywall|class=["'][^"']*paywall/.test(sample)
  );
}

export function describeHttpFetchError(status: number): string {
  if (status === 401 || status === 403) {
    return 'This page looks login-gated or blocked. Paste the recipe text or try a screenshot instead.';
  }
  if (status === 404) {
    return 'That link could not be found. Check the URL, or paste the recipe text instead.';
  }
  if (status === 429) {
    return 'The site asked us to slow down. Wait a moment and retry, or paste the recipe text.';
  }
  return `Could not fetch URL (HTTP ${status})`;
}

export function instagramCaptionLooksThin(caption: string | null): boolean {
  if (!caption?.trim()) return true;
  const text = caption.replace(/\s+/g, ' ').trim();
  if (text.length < 40) return true;
  const hasRecipeSignal =
    /\b(ingredient|tbsp|tsp|grams?|method|preheat|serves|recipe)\b/i.test(
      text,
    ) || /\n/.test(caption);
  return !hasRecipeSignal && text.length < 120;
}

export type RecipeExtractWarningCode =
  | 'missing_ingredients'
  | 'missing_instructions'
  | 'missing_servings'
  | 'thin_caption'
  | 'already_imported';

export type RecipeExtractWarning = {
  code: RecipeExtractWarningCode;
  message: string;
};

export function buildExtractWarnings(input: {
  ingredients: string[];
  instructions: string | null;
  servings: number | null;
  thinCaption?: boolean;
}): RecipeExtractWarning[] {
  const warnings: RecipeExtractWarning[] = [];
  if (input.ingredients.length === 0) {
    warnings.push({
      code: 'missing_ingredients',
      message:
        'Couldn’t read ingredients — paste them from the original, or retry with a screenshot.',
    });
  }
  if (!input.instructions?.trim()) {
    warnings.push({
      code: 'missing_instructions',
      message:
        'No method found. Paste the steps before you cook, or retry the import.',
    });
  }
  if (input.servings == null) {
    warnings.push({
      code: 'missing_servings',
      message: 'Servings were unclear — set how many it makes before saving.',
    });
  }
  if (input.thinCaption) {
    warnings.push({
      code: 'thin_caption',
      message:
        'The Instagram caption was thin (video-only posts often are). Check amounts, or paste the caption.',
    });
  }
  return warnings;
}

export function extractMethodLabel(
  method: string | null | undefined,
): string | null {
  switch (method) {
    case 'schema_org':
      return 'From the page’s recipe data';
    case 'instagram_caption':
      return 'From the Instagram caption';
    case 'llm_image':
      return 'Read from the photo';
    case 'llm_text':
      return 'Read from the page text';
    default:
      return null;
  }
}
