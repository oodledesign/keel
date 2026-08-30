import { load } from 'cheerio';

import { extractPageJsonLd, getObjectSchemaTypes } from '~/lib/crawl/json-ld';

import {
  type RecipeImageCandidate,
  isPrivateOrLocalUrl,
  parsePublicHttpUrl,
  schemaOrgImageUrls,
} from './recipe-extract-utils';

const MAX_CANDIDATES = 8;
const MAX_CONTENT_IMAGES = 5;

const SKIP_IMAGE_URL =
  /favicon|sprite|pixel|1x1|badge|tracking|doubleclick|adservice|\/icon[-_]|logo\.svg/i;

function resolvePageUrl(value: string, pageUrl: string): string | null {
  try {
    return parsePublicHttpUrl(new URL(value.trim(), pageUrl).href);
  } catch {
    return parsePublicHttpUrl(value);
  }
}

function pushCandidate(
  list: RecipeImageCandidate[],
  seen: Set<string>,
  url: string | null,
  source: RecipeImageCandidate['source'],
) {
  if (!url || seen.has(url) || isPrivateOrLocalUrl(url)) return;
  if (SKIP_IMAGE_URL.test(url)) return;
  seen.add(url);
  list.push({ url, source });
}

function isTinyDeclaredImage(width?: string, height?: string): boolean {
  const w = width ? Number.parseInt(width, 10) : Number.NaN;
  const h = height ? Number.parseInt(height, 10) : Number.NaN;
  if (Number.isFinite(w) && Number.isFinite(h) && w < 200 && h < 200) {
    return true;
  }
  if (Number.isFinite(w) && w < 80) return true;
  if (Number.isFinite(h) && h < 80) return true;
  return false;
}

function collectSchemaRecipeImages(html: string, pageUrl: string): string[] {
  const $ = load(html);
  const { schemaObjects } = extractPageJsonLd($);
  const urls: string[] = [];

  for (const item of schemaObjects) {
    if (!getObjectSchemaTypes(item).includes('Recipe')) continue;
    for (const raw of schemaOrgImageUrls(item.image)) {
      const resolved = resolvePageUrl(raw, pageUrl);
      if (resolved) urls.push(resolved);
    }
  }

  return urls;
}

/**
 * Candidate covers for a recipe web page: og:image, schema.org Recipe.image,
 * then a few large-looking content images. Instagram is handled separately
 * via oembed (do not scrape login-gated media).
 */
export function collectRecipeImageCandidates(
  html: string,
  pageUrl: string,
): RecipeImageCandidate[] {
  const $ = load(html);
  const seen = new Set<string>();
  const candidates: RecipeImageCandidate[] = [];

  const og =
    $('meta[property="og:image"]').attr('content') ??
    $('meta[property="og:image:url"]').attr('content') ??
    $('meta[name="og:image"]').attr('content');
  pushCandidate(candidates, seen, resolvePageUrl(og ?? '', pageUrl), 'og');

  const twitter =
    $('meta[name="twitter:image"]').attr('content') ??
    $('meta[property="twitter:image"]').attr('content');
  pushCandidate(candidates, seen, resolvePageUrl(twitter ?? '', pageUrl), 'og');

  for (const url of collectSchemaRecipeImages(html, pageUrl)) {
    pushCandidate(candidates, seen, url, 'schema');
    if (candidates.length >= MAX_CANDIDATES) return candidates;
  }

  const contentRoots = $('main img, article img, [itemtype*="Recipe"] img');
  const extras = contentRoots.length ? contentRoots : $('img');

  extras.each((_, el) => {
    if (candidates.length >= MAX_CANDIDATES) return false;
    const node = $(el);
    if (isTinyDeclaredImage(node.attr('width'), node.attr('height'))) {
      return;
    }

    const src =
      node.attr('src') ??
      node.attr('data-src') ??
      node.attr('data-lazy-src') ??
      '';
    const resolved = resolvePageUrl(src, pageUrl);
    if (!resolved) return;

    const contentSoFar = candidates.filter(
      (item) => item.source === 'content',
    ).length;
    if (contentSoFar >= MAX_CONTENT_IMAGES) return false;

    pushCandidate(candidates, seen, resolved, 'content');
  });

  return candidates.slice(0, MAX_CANDIDATES);
}
