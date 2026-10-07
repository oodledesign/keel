import { createHash } from 'crypto';

export type ParsedReviewRow = {
  externalId: string;
  reviewerName: string;
  rating: number;
  comment: string | null;
  reviewedAt: string | null;
};

export type ReviewCsvResult = {
  reviews: ParsedReviewRow[];
  errors: Array<{ line: number; message: string }>;
};

/** RFC 4180 parser: quoted fields may contain commas, quotes and newlines. */
export function parseCsvRecords(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      cell = '';
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

const HEADER_ALIASES: Record<string, string[]> = {
  name: ['reviewer', 'reviewername', 'name', 'author', 'customer'],
  rating: ['rating', 'stars', 'score'],
  comment: ['comment', 'review', 'text', 'reviewtext', 'content'],
  date: ['date', 'reviewdate', 'reviewedat', 'created', 'time'],
};

function findColumn(headers: string[], key: keyof typeof HEADER_ALIASES) {
  const normalized = headers.map((h) => h.toLowerCase().replace(/[^a-z]/g, ''));
  return normalized.findIndex((h) => HEADER_ALIASES[key]!.includes(h));
}

export function parseReviewDate(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const dmy = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  const date = dmy
    ? new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])))
    : new Date(v);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Stable id so re-importing the same CSV updates instead of duplicating. */
export function csvReviewExternalId(
  name: string,
  rating: number,
  comment: string | null,
  reviewedAt: string | null,
) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        name.trim().toLowerCase(),
        rating,
        comment ?? '',
        reviewedAt ?? '',
      ]),
    )
    .digest('hex')
    .slice(0, 32);
}

export const MAX_REVIEW_CSV_ROWS = 1000;

export function parseReviewsCsv(text: string): ReviewCsvResult {
  const records = parseCsvRecords(text);
  const errors: ReviewCsvResult['errors'] = [];
  const headers = records[0]?.map((h) => h.trim()) ?? [];

  const nameIdx = findColumn(headers, 'name');
  const ratingIdx = findColumn(headers, 'rating');
  const commentIdx = findColumn(headers, 'comment');
  const dateIdx = findColumn(headers, 'date');

  if (nameIdx < 0 || ratingIdx < 0) {
    return {
      reviews: [],
      errors: [
        {
          line: 1,
          message: 'Header row needs at least "reviewer" and "rating" columns',
        },
      ],
    };
  }

  const reviews: ParsedReviewRow[] = [];
  const seen = new Set<string>();

  records.slice(1, MAX_REVIEW_CSV_ROWS + 1).forEach((row, index) => {
    const line = index + 2;
    const name = (row[nameIdx] ?? '').trim();
    const rating = Math.round(Number((row[ratingIdx] ?? '').trim()));
    if (!name) {
      errors.push({ line, message: 'Missing reviewer name' });
      return;
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      errors.push({ line, message: 'Rating must be 1 to 5' });
      return;
    }
    const comment =
      commentIdx >= 0
        ? (row[commentIdx] ?? '').trim().slice(0, 4000) || null
        : null;
    const reviewedAt =
      dateIdx >= 0 ? parseReviewDate(row[dateIdx] ?? '') : null;
    const externalId = csvReviewExternalId(name, rating, comment, reviewedAt);
    if (seen.has(externalId)) return;
    seen.add(externalId);
    reviews.push({
      externalId,
      reviewerName: name.slice(0, 200),
      rating,
      comment,
      reviewedAt,
    });
  });

  if (records.length - 1 > MAX_REVIEW_CSV_ROWS) {
    errors.push({
      line: MAX_REVIEW_CSV_ROWS + 2,
      message: `Only the first ${MAX_REVIEW_CSV_ROWS} rows were read`,
    });
  }
  return { reviews, errors };
}
