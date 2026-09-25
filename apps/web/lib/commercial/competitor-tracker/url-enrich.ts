import 'server-only';

import { isSafePublicProbeUrl } from '~/lib/commercial/listing-website-url-health';
import {
  fetchPageHtmlWithFirecrawl,
  isFirecrawlConfigured,
} from '~/lib/firecrawl/scrape-page';

import {
  type CompetitorTenure,
  normalizeCompetitorTenure,
  parsePriceToPence,
} from './constants';
import type { CompetitorUrlEnrichment } from './types';

export type { CompetitorUrlEnrichment } from './types';

function stripTags(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&pound;/g, '£')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMeta(html: string, property: string) {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    'i',
  );
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
    'i',
  );
  return html.match(re)?.[1] ?? html.match(alt)?.[1] ?? null;
}

function extractTitle(html: string) {
  return (
    extractMeta(html, 'og:title') ||
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ||
    null
  );
}

function extractPostcode(text: string) {
  const match = text.match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i);
  return match?.[1]?.toUpperCase().replace(/\s+/, ' ') ?? null;
}

function extractSizeSqft(text: string) {
  const match = text.match(
    /([\d,]+(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|square\s*feet)/i,
  );
  if (!match) return null;
  const n = Number(match[1]!.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function extractPrice(text: string) {
  const match =
    text.match(
      /(?:asking\s*price|guide\s*price|rent|price)[:\s]*£\s*([\d,]+(?:\.\d+)?)\s*(k|m)?/i,
    ) ||
    text.match(
      /£\s*([\d,]+(?:\.\d+)?)\s*(k|m)?(?:\s*(?:pa|pcm|per\s*annum))?/i,
    );
  if (!match) return null;
  return parsePriceToPence(`${match[1]}${match[2] ?? ''}`);
}

function extractAgent(text: string) {
  const match =
    text.match(
      /(?:marketed\s*by|agent|listed\s*by)\s*[-:]?\s*([A-Z][\w&.'\s-]{2,60})/i,
    ) ||
    text.match(
      /\b([A-Z][\w&]+(?:\s+[A-Z][\w&]+){0,3}\s+(?:Ltd|LLP|Limited|Property|Commercial))\b/,
    );
  return match?.[1]?.trim() ?? null;
}

function extractTenure(text: string): CompetitorTenure | null {
  if (/to\s*let|for\s*rent|leasehold\s*to\s*let/i.test(text)) return 'to_let';
  if (/for\s*sale|freehold\s*for\s*sale/i.test(text)) return 'sale';
  return normalizeCompetitorTenure(
    /sale/i.test(text) ? 'sale' : /let|rent/i.test(text) ? 'to_let' : null,
  );
}

/**
 * Assisted URL enrichment for Tracker. Uses Firecrawl when configured;
 * parses common commercial listing signals from HTML. Not a guaranteed scrape.
 */
export async function enrichCompetitorFromUrl(
  url: string,
): Promise<CompetitorUrlEnrichment> {
  const sourceUrl = url.trim();
  const warnings: string[] = [];

  if (!/^https?:\/\//i.test(sourceUrl)) {
    throw new Error('URL must start with http:// or https://');
  }

  if (!isSafePublicProbeUrl(sourceUrl)) {
    throw new Error('URL must be a public external address');
  }

  let html: string | null = null;
  if (isFirecrawlConfigured()) {
    html = await fetchPageHtmlWithFirecrawl(sourceUrl);
    if (!html) {
      warnings.push('Could not fetch page via Firecrawl');
    }
  } else {
    warnings.push('FIRECRAWL_API_KEY not set — limited enrichment');
    try {
      const res = await fetch(sourceUrl, {
        headers: { 'User-Agent': 'OzerTrackerBot/1.0' },
        signal: AbortSignal.timeout(10_000),
        redirect: 'follow',
      });
      if (res.ok) {
        html = await res.text();
      } else {
        warnings.push(`Direct fetch failed (${res.status})`);
      }
    } catch {
      warnings.push('Direct fetch failed');
    }
  }

  if (!html) {
    return {
      name: null,
      locationText: null,
      postcode: null,
      sizeSqft: null,
      pricePence: null,
      tenure: null,
      competitorAgent: null,
      sourceUrl,
      confidence: 'low',
      rawTitle: null,
      warnings,
    };
  }

  const title = extractTitle(html);
  const description = extractMeta(html, 'og:description') || '';
  const text = `${title ?? ''} ${description} ${stripTags(html).slice(0, 12000)}`;

  const postcode = extractPostcode(text);
  const sizeSqft = extractSizeSqft(text);
  const pricePence = extractPrice(text);
  const competitorAgent = extractAgent(text);
  const tenure = extractTenure(text);

  let name = title?.replace(/\s*[|\-–].*$/, '').trim() || null;
  if (name && name.length > 120) name = `${name.slice(0, 117)}…`;

  const locationText =
    postcode && name
      ? name
      : (description.split(/[.|]/)[0]?.trim().slice(0, 160) ?? null);

  const filled = [name, postcode, sizeSqft, pricePence, competitorAgent].filter(
    Boolean,
  ).length;
  const confidence =
    filled >= 4 ? 'high' : filled >= 2 ? 'medium' : ('low' as const);

  if (confidence === 'low') {
    warnings.push('Few fields detected — review before saving');
  }

  return {
    name,
    locationText,
    postcode,
    sizeSqft,
    pricePence,
    tenure,
    competitorAgent,
    sourceUrl,
    confidence,
    rawTitle: title,
    warnings,
  };
}
