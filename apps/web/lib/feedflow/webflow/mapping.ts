/** Review attributes that can be pushed into a Webflow collection field. */
export const REVIEW_MAPPABLE_KEYS = [
  'reviewer_name',
  'rating',
  'comment',
  'reviewed_at',
  'reply',
  'reviewer_photo_url',
] as const;

export type ReviewMappableKey = (typeof REVIEW_MAPPABLE_KEYS)[number];

export const REVIEW_KEY_LABELS: Record<ReviewMappableKey, string> = {
  reviewer_name: 'Reviewer name',
  rating: 'Star rating',
  comment: 'Review text',
  reviewed_at: 'Review date',
  reply: 'Owner reply',
  reviewer_photo_url: 'Reviewer photo',
};

/** Review key → Webflow field slug. */
export type ReviewFieldMapping = Partial<Record<ReviewMappableKey, string>>;

export type WebflowFieldInfo = {
  slug: string;
  displayName: string;
  type: string;
  isRequired: boolean;
};

export type SyncableReview = {
  id: string;
  reviewer_name: string;
  reviewer_photo_url: string | null;
  rating: number;
  comment: string | null;
  reply: string | null;
  reviewed_at: string | null;
  hidden: boolean;
};

export type SyncSettings = {
  syncMode: 'all' | 'with_text';
  minRating: number;
  minCharacterCount: number;
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

const SUGGESTION_TERMS: Record<ReviewMappableKey, string[]> = {
  reviewer_name: ['reviewer', 'author', 'customer', 'person'],
  rating: ['rating', 'stars', 'score'],
  comment: ['comment', 'review', 'text', 'content', 'body', 'testimonial'],
  reviewed_at: ['date', 'published', 'reviewedat'],
  reply: ['reply', 'response'],
  reviewer_photo_url: ['photo', 'avatar', 'image', 'picture'],
};

const COMPATIBLE_TYPES: Record<ReviewMappableKey, (type: string) => boolean> = {
  reviewer_name: (t) => t === 'PlainText',
  rating: (t) => t === 'Number' || t === 'PlainText',
  comment: (t) => t === 'PlainText' || t === 'RichText',
  reviewed_at: (t) => t === 'DateTime' || t === 'PlainText',
  reply: (t) => t === 'PlainText' || t === 'RichText',
  reviewer_photo_url: (t) => t === 'Image' || t === 'Link' || t === 'PlainText',
};

export function isFieldCompatible(key: ReviewMappableKey, type: string) {
  return COMPATIBLE_TYPES[key](type);
}

/** Best-effort first mapping from field names; the user can adjust it. */
export function suggestFieldMapping(
  fields: WebflowFieldInfo[],
): ReviewFieldMapping {
  const mapping: ReviewFieldMapping = {};
  const used = new Set<string>(['name', 'slug']);

  for (const key of REVIEW_MAPPABLE_KEYS) {
    const candidate = fields.find((field) => {
      if (used.has(field.slug) || !isFieldCompatible(key, field.type)) {
        return false;
      }
      const haystack = normalize(`${field.slug}${field.displayName}`);
      return SUGGESTION_TERMS[key].some((term) => haystack.includes(term));
    });
    if (candidate) {
      mapping[key] = candidate.slug;
      used.add(candidate.slug);
    }
  }
  return mapping;
}

/** Drop mappings to fields that no longer exist or have an unusable type. */
export function sanitizeFieldMapping(
  mapping: unknown,
  fields: WebflowFieldInfo[],
): ReviewFieldMapping {
  const out: ReviewFieldMapping = {};
  if (!mapping || typeof mapping !== 'object') return out;
  const used = new Set<string>();

  for (const key of REVIEW_MAPPABLE_KEYS) {
    const slug = (mapping as Record<string, unknown>)[key];
    if (typeof slug !== 'string' || used.has(slug)) continue;
    const field = fields.find((candidate) => candidate.slug === slug);
    if (
      field &&
      field.slug !== 'name' &&
      field.slug !== 'slug' &&
      isFieldCompatible(key, field.type)
    ) {
      out[key] = slug;
      used.add(slug);
    }
  }
  return out;
}

export function missingRequiredFields(
  mapping: ReviewFieldMapping,
  fields: WebflowFieldInfo[],
): WebflowFieldInfo[] {
  const mapped = new Set(Object.values(mapping));
  return fields.filter(
    (field) =>
      field.isRequired &&
      field.slug !== 'name' &&
      field.slug !== 'slug' &&
      !mapped.has(field.slug),
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toRichText(value: string) {
  return value
    .split(/\n{2,}/)
    .map(
      (paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`,
    )
    .join('');
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

export function reviewItemName(review: SyncableReview) {
  return `${review.reviewer_name.trim() || 'Anonymous'} — ${review.rating}★`;
}

/** Stable, unique slug: name plus a short id so repeat reviewers never clash. */
export function reviewItemSlug(review: SyncableReview) {
  const base = slugify(review.reviewer_name) || 'review';
  return `${base}-${review.id.replace(/-/g, '').slice(0, 8)}`;
}

function fieldValue(
  key: ReviewMappableKey,
  field: WebflowFieldInfo,
  review: SyncableReview,
): unknown {
  switch (key) {
    case 'reviewer_name':
      return review.reviewer_name;
    case 'rating':
      return field.type === 'Number' ? review.rating : String(review.rating);
    case 'comment':
    case 'reply': {
      const text = (key === 'comment' ? review.comment : review.reply)?.trim();
      if (!text) return null;
      return field.type === 'RichText' ? toRichText(text) : text;
    }
    case 'reviewed_at': {
      if (!review.reviewed_at) return null;
      const date = new Date(review.reviewed_at);
      if (Number.isNaN(date.getTime())) return null;
      return field.type === 'DateTime'
        ? date.toISOString()
        : date.toISOString().slice(0, 10);
    }
    case 'reviewer_photo_url': {
      // Only plain web URLs ever reach Webflow image/link fields.
      if (!/^https?:\/\//i.test(review.reviewer_photo_url ?? '')) return null;
      return field.type === 'Image'
        ? { url: review.reviewer_photo_url! }
        : review.reviewer_photo_url;
    }
  }
}

export function buildReviewFieldData(
  review: SyncableReview,
  mapping: ReviewFieldMapping,
  fields: WebflowFieldInfo[],
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    name: reviewItemName(review),
    slug: reviewItemSlug(review),
  };
  for (const key of REVIEW_MAPPABLE_KEYS) {
    const slug = mapping[key];
    const field = slug ? fields.find((f) => f.slug === slug) : undefined;
    if (!slug || !field) continue;
    const value = fieldValue(key, field, review);
    if (value !== null) data[slug] = value;
  }
  return data;
}

/** Which reviews should exist in Webflow under the connection's settings. */
export function shouldSyncReview(
  review: SyncableReview,
  settings: SyncSettings,
): boolean {
  if (review.hidden) return false;
  if (review.rating < settings.minRating) return false;
  const length = review.comment?.trim().length ?? 0;
  if (settings.syncMode === 'with_text' && length === 0) return false;
  if (length > 0 && length < settings.minCharacterCount) return false;
  if (length === 0 && settings.minCharacterCount > 0) return false;
  return true;
}
