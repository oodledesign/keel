import { z } from 'zod';

import type {
  EmailActionItem,
  EmailThreadCategory,
  ExtractResponseJson,
  PipelineLeadDetection,
} from './types';

const ExtractItemSchema = z.object({
  title: z.string(),
  detail: z.string().nullable().optional(),
  suggested_due_date: z.string().nullable().optional(),
  suggested_duration_minutes: z
    .union([z.number(), z.string()])
    .nullable()
    .optional(),
  source_excerpt: z.string().nullable().optional(),
  assignee_confidence: z.number().nullable().optional(),
  suggested_assignee_email: z.string().nullable().optional(),
});

const ExtractResponseSchema = z.object({
  items: z.array(ExtractItemSchema),
});

const DetectPipelineLeadResponseSchema = z.object({
  is_lead: z.boolean(),
  contact_name: z.string().nullable().optional(),
  company_name: z.string().nullable().optional(),
  contact_email: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
});

const ClassifyResponseSchema = z.object({
  category: z.enum(['reply_now', 'reply_later', 'waiting', 'fyi', 'noise']),
  reason: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
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

const MAX_DURATION_MINUTES = 10_080;

/** Keep in sync with `apps/web/lib/tasks/task-duration.ts` (this package cannot import from the web app). */
export function normalizeDurationMinutes(
  value: number | string | null | undefined,
): number | null {
  if (value == null || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    const rounded = Math.round(value);
    return rounded > 0 && rounded <= MAX_DURATION_MINUTES ? rounded : null;
  }

  const text = value.trim().toLowerCase();
  if (!text) return null;

  if (/^\d+(\.\d+)?$/.test(text)) {
    const rounded = Math.round(Number(text));
    return rounded > 0 && rounded <= MAX_DURATION_MINUTES ? rounded : null;
  }

  const combined =
    /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\s*(?:and\s*)?(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)\b/.exec(
      text,
    );
  if (combined) {
    const total = Number(combined[1]) * 60 + Number(combined[2]);
    const rounded = Math.round(total);
    return rounded > 0 && rounded <= MAX_DURATION_MINUTES ? rounded : null;
  }

  const hourOnly = /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/.exec(text);
  const minuteOnly = /(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)\b/.exec(text);
  if (hourOnly && !minuteOnly) {
    const rounded = Math.round(Number(hourOnly[1]) * 60);
    return rounded > 0 && rounded <= MAX_DURATION_MINUTES ? rounded : null;
  }
  if (minuteOnly) {
    const rounded = Math.round(Number(minuteOnly[1]));
    return rounded > 0 && rounded <= MAX_DURATION_MINUTES ? rounded : null;
  }

  return null;
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
      suggestedDurationMinutes: normalizeDurationMinutes(
        item.suggested_duration_minutes,
      ),
      sourceExcerpt: normalizeExcerpt(item.source_excerpt),
      assigneeConfidence: normalizeConfidence(item.assignee_confidence),
      suggestedAssigneeEmail: normalizeEmail(item.suggested_assignee_email),
    }))
    .filter((item) => item.title.length > 0);
}

export function parseClassifyResponse(raw: string): {
  category: EmailThreadCategory | null;
  reason: string | null;
  confidence: number | null;
} {
  const cleaned = stripJsonFences(raw);

  let json: unknown;

  try {
    json = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');

    if (start < 0 || end <= start) {
      return {
        category: null,
        reason: 'Could not parse classification',
        confidence: null,
      };
    }

    try {
      json = JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return {
        category: null,
        reason: 'Could not parse classification',
        confidence: null,
      };
    }
  }

  const parsed = ClassifyResponseSchema.safeParse(json);

  if (!parsed.success) {
    return {
      category: null,
      reason: 'Could not parse classification',
      confidence: null,
    };
  }

  return {
    category: parsed.data.category,
    reason: parsed.data.reason?.trim() || null,
    confidence: normalizeConfidence(parsed.data.confidence),
  };
}

export function parseDetectPipelineLeadResponse(
  raw: string,
): PipelineLeadDetection {
  const cleaned = stripJsonFences(raw);

  let json: unknown;

  try {
    json = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');

    if (start < 0 || end <= start) {
      return {
        isLead: false,
        contactName: null,
        companyName: null,
        contactEmail: null,
        description: null,
        reason: 'Could not parse lead detection',
        confidence: null,
      };
    }

    try {
      json = JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return {
        isLead: false,
        contactName: null,
        companyName: null,
        contactEmail: null,
        description: null,
        reason: 'Could not parse lead detection',
        confidence: null,
      };
    }
  }

  const parsed = DetectPipelineLeadResponseSchema.safeParse(json);

  if (!parsed.success) {
    return {
      isLead: false,
      contactName: null,
      companyName: null,
      contactEmail: null,
      description: null,
      reason: 'Could not parse lead detection',
      confidence: null,
    };
  }

  return {
    isLead: parsed.data.is_lead,
    contactName: parsed.data.contact_name?.trim() || null,
    companyName: parsed.data.company_name?.trim() || null,
    contactEmail: normalizeEmail(parsed.data.contact_email),
    description: parsed.data.description?.trim() || null,
    reason: parsed.data.reason?.trim() || null,
    confidence: normalizeConfidence(parsed.data.confidence),
  };
}

export function serializeExtractResponse(
  items: EmailActionItem[],
): ExtractResponseJson {
  return {
    items: items.map((item) => ({
      title: item.title,
      detail: item.detail,
      suggested_due_date: item.suggestedDueDate,
      suggested_duration_minutes: item.suggestedDurationMinutes,
      source_excerpt: item.sourceExcerpt,
      assignee_confidence: item.assigneeConfidence,
      suggested_assignee_email: item.suggestedAssigneeEmail,
    })),
  };
}
