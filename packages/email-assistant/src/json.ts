import { z } from 'zod';

import type {
  EmailActionItem,
  EmailThreadCategory,
  ExtractResponseJson,
} from './types';

const ExtractItemSchema = z.object({
  title: z.string(),
  detail: z.string().nullable().optional(),
  suggested_due_date: z.string().nullable().optional(),
  source_excerpt: z.string().nullable().optional(),
  assignee_confidence: z.number().nullable().optional(),
  suggested_assignee_email: z.string().nullable().optional(),
});

const ExtractResponseSchema = z.object({
  items: z.array(ExtractItemSchema),
});

const ClassifyResponseSchema = z.object({
  category: z.enum(['needs_reply', 'no_reply']),
  reason: z.string().nullable().optional(),
});

/** Strip accidental markdown fences before JSON.parse. */
export function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed);

  if (fenced?.[1]) {
    return fenced[1]!.trim();
  }

  return trimmed;
}

function normalizeDueDate(value: string | null | undefined): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

function normalizeConfidence(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }

  const clamped = Math.min(1, Math.max(0, value));
  return Math.round(clamped * 1000) / 1000;
}

function normalizeEmail(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed || !trimmed.includes('@')) {
    return null;
  }
  return trimmed;
}

function normalizeExcerpt(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.length > 200 ? `${trimmed.slice(0, 197)}…` : trimmed;
}

export function parseExtractResponse(raw: string): EmailActionItem[] {
  const cleaned = stripJsonFences(raw);

  let json: unknown;

  try {
    json = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');

    if (start < 0 || end <= start) {
      return [];
    }

    try {
      json = JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return [];
    }
  }

  const parsed = ExtractResponseSchema.safeParse(json);

  if (!parsed.success) {
    return [];
  }

  return parsed.data.items
    .map((item) => ({
      title: item.title.trim(),
      detail: item.detail?.trim() || null,
      suggestedDueDate: normalizeDueDate(item.suggested_due_date),
      sourceExcerpt: normalizeExcerpt(item.source_excerpt),
      assigneeConfidence: normalizeConfidence(item.assignee_confidence),
      suggestedAssigneeEmail: normalizeEmail(item.suggested_assignee_email),
    }))
    .filter((item) => item.title.length > 0);
}

export function parseClassifyResponse(raw: string): {
  category: EmailThreadCategory;
  reason: string | null;
} {
  const cleaned = stripJsonFences(raw);

  let json: unknown;

  try {
    json = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');

    if (start < 0 || end <= start) {
      return { category: 'no_reply', reason: 'Could not parse classification' };
    }

    try {
      json = JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return { category: 'no_reply', reason: 'Could not parse classification' };
    }
  }

  const parsed = ClassifyResponseSchema.safeParse(json);

  if (!parsed.success) {
    return { category: 'no_reply', reason: 'Could not parse classification' };
  }

  return {
    category: parsed.data.category,
    reason: parsed.data.reason?.trim() || null,
  };
}

export function serializeExtractResponse(items: EmailActionItem[]): ExtractResponseJson {
  return {
    items: items.map((item) => ({
      title: item.title,
      detail: item.detail,
      suggested_due_date: item.suggestedDueDate,
      source_excerpt: item.sourceExcerpt,
      assignee_confidence: item.assigneeConfidence,
      suggested_assignee_email: item.suggestedAssigneeEmail,
    })),
  };
}
