const MAX_LABEL = 80;

const SHORT_UPPERCASE = new Set([
  'nyt',
  'bbc',
  'cnn',
  'itv',
  'nbc',
  'abc',
  'npr',
  'wsj',
  'ft',
]);

const STRIPPABLE_SUFFIX = /(magazine|recipes|cooking|kitchen|blog)$/i;

export function cleanSiteLabel(value: string): string | null {
  const trimmed = value.replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL);
  if (!trimmed) return null;
  if (/^ai(\s+generated)?$/i.test(trimmed)) return null;
  return trimmed;
}

export function schemaOrgPublisherName(value: unknown): string | null {
  if (typeof value === 'string') return cleanSiteLabel(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const name = schemaOrgPublisherName(item);
      if (name) return name;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return schemaOrgPublisherName(record.name ?? record.legalName);
  }
  return null;
}

/** nyt.com → NYT; deliciousmagazine.co.uk → Delicious */
export function tidyHostnameLabel(hostname: string): string {
  const host = hostname.replace(/^www\./i, '').toLowerCase();
  const labels = host.split('.').filter(Boolean);
  let name = labels[0] ?? host;

  if (SHORT_UPPERCASE.has(name)) {
    return name.toUpperCase();
  }

  const stripped = name.replace(STRIPPABLE_SUFFIX, '');
  if (stripped.length >= 4) name = stripped;

  return name
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function tidySiteLabelFromUrl(url: string): string {
  try {
    return tidyHostnameLabel(new URL(url).hostname);
  } catch {
    return 'Website';
  }
}

export function resolveExtractOrigin(
  sourceUrl: string | null,
  siteLabel?: string | null,
): {
  source: 'instagram' | 'website';
  source_label: string;
} | null {
  if (!sourceUrl) return null;

  try {
    const host = new URL(sourceUrl).hostname
      .replace(/^www\./, '')
      .toLowerCase();
    if (host === 'instagram.com' || host === 'instagr.am') {
      return { source: 'instagram', source_label: 'Instagram' };
    }
  } catch {
    return null;
  }

  const label =
    cleanSiteLabel(siteLabel ?? '') ?? tidySiteLabelFromUrl(sourceUrl);
  return { source: 'website', source_label: label };
}

export function recipeOriginLabel(input: {
  source?: string | null;
  sourceLabel?: string | null;
  sourceUrl?: string | null;
}): string | null {
  if (input.source === 'manual' || !input.source) return null;
  if (input.source === 'ai') return 'AI generated';

  if (input.source === 'instagram') {
    return cleanSiteLabel(input.sourceLabel ?? '') ?? 'Instagram';
  }

  if (input.source === 'website') {
    return (
      cleanSiteLabel(input.sourceLabel ?? '') ??
      (input.sourceUrl ? tidySiteLabelFromUrl(input.sourceUrl) : 'Website')
    );
  }

  return null;
}
