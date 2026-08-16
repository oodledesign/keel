import { z } from 'zod';

import {
  RECIPE_MEAL_TYPES,
  type RecipeMealType,
} from '~/home/(user)/life/family/_lib/schema/family-meal.schema';
import { getObjectSchemaTypes } from '~/lib/crawl/json-ld';

/**
 * Draft matching `family_recipes` insertable fields (review/edit only — never auto-saved).
 */
export const ExtractedRecipeDraftSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1_000).nullable(),
  ingredients: z.array(z.string().trim().min(1).max(200)).max(80),
  instructions: z.string().trim().max(8_000).nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
  meal_type: z.enum(RECIPE_MEAL_TYPES),
  prep_minutes: z.number().int().min(0).max(1_440).nullable(),
  cook_minutes: z.number().int().min(0).max(1_440).nullable(),
  servings: z.number().int().min(1).max(50).nullable(),
  is_favorite: z.literal(false),
  source: z.literal('ai'),
});

export type ExtractedRecipeDraft = z.infer<typeof ExtractedRecipeDraftSchema>;

export function emptyRecipeDraft(): ExtractedRecipeDraft {
  return {
    name: 'Untitled recipe',
    description: null,
    ingredients: [],
    instructions: null,
    tags: [],
    meal_type: 'dinner',
    prep_minutes: null,
    cook_minutes: null,
    servings: null,
    is_favorite: false,
    source: 'ai',
  };
}

export function parseOptionalInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }
  if (typeof value === 'string' && value.trim()) {
    const match = value.trim().match(/(\d+)/);
    if (match?.[1]) {
      const n = Number.parseInt(match[1], 10);
      return Number.isFinite(n) ? Math.max(0, n) : null;
    }
  }
  return null;
}

export function parseServings(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.min(50, Math.round(value));
  }
  if (typeof value === 'string') {
    const match = value.match(/(\d+)/);
    if (match?.[1]) {
      const n = Number.parseInt(match[1], 10);
      if (Number.isFinite(n) && n > 0) return Math.min(50, n);
    }
  }
  return null;
}

/** Parse ISO-8601 durations like PT1H30M or PT45M into whole minutes. */
export function isoDurationToMinutes(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const match = value
    .trim()
    .toUpperCase()
    .match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
  if (!match) return null;
  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);
  const total =
    days * 24 * 60 + hours * 60 + minutes + Math.round(seconds / 60);
  return total >= 0 ? total : null;
}

export function normalizeMealType(value: unknown): RecipeMealType {
  if (typeof value !== 'string') return 'dinner';
  const normalised = value.trim().toLowerCase();
  if ((RECIPE_MEAL_TYPES as readonly string[]).includes(normalised)) {
    return normalised as RecipeMealType;
  }
  if (normalised.includes('breakfast')) return 'breakfast';
  if (normalised.includes('lunch')) return 'lunch';
  if (normalised.includes('snack') || normalised.includes('dessert')) {
    return 'snack';
  }
  if (normalised.includes('dinner') || normalised.includes('supper')) {
    return 'dinner';
  }
  return 'dinner';
}

export function stringList(value: unknown): string[] {
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        if (typeof record.text === 'string') return record.text.trim();
        if (typeof record.name === 'string') return record.name.trim();
      }
      return '';
    })
    .filter(Boolean);
}

export function instructionsToText(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();

  if (Array.isArray(value)) {
    const lines: string[] = [];
    let stepCounter = 0;
    for (const step of value) {
      if (typeof step === 'string' && step.trim()) {
        stepCounter += 1;
        lines.push(`${stepCounter}. ${step.trim()}`);
        continue;
      }
      if (!step || typeof step !== 'object') continue;
      const record = step as Record<string, unknown>;
      const types = getObjectSchemaTypes(record);
      if (types.includes('HowToSection')) {
        const sectionName =
          typeof record.name === 'string' ? record.name.trim() : '';
        const nested = instructionsToText(record.itemListElement);
        if (sectionName && nested) {
          lines.push(`${sectionName}\n${nested}`);
        } else if (nested) {
          lines.push(nested);
        } else if (sectionName) {
          lines.push(sectionName);
        }
        continue;
      }
      const text =
        (typeof record.text === 'string' && record.text.trim()) ||
        (typeof record.name === 'string' && record.name.trim()) ||
        '';
      if (text) {
        stepCounter += 1;
        lines.push(`${stepCounter}. ${text}`);
      }
    }
    return lines.length ? lines.join('\n') : null;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.text === 'string' && record.text.trim()) {
      return record.text.trim();
    }
    return instructionsToText(record.itemListElement);
  }

  return null;
}

export function normalizeExtractedRecipeDraft(
  raw: unknown,
): ExtractedRecipeDraft {
  const base = emptyRecipeDraft();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;

  const name =
    typeof r.name === 'string' && r.name.trim() ? r.name.trim() : base.name;
  const description =
    typeof r.description === 'string' && r.description.trim()
      ? r.description.trim().slice(0, 1_000)
      : null;
  const ingredients = stringList(r.ingredients)
    .map((line) => line.slice(0, 200))
    .slice(0, 80);
  const instructionsRaw =
    typeof r.instructions === 'string'
      ? r.instructions.trim()
      : instructionsToText(r.instructions);
  const tags = stringList(r.tags)
    .map((tag) => tag.slice(0, 40))
    .slice(0, 20);
  const meal_type = normalizeMealType(r.meal_type ?? r.mealType);

  const draft: ExtractedRecipeDraft = {
    name: name.slice(0, 160),
    description,
    ingredients,
    instructions: instructionsRaw ? instructionsRaw.slice(0, 8_000) : null,
    tags,
    meal_type,
    prep_minutes: parseOptionalInt(r.prep_minutes ?? r.prepMinutes),
    cook_minutes: parseOptionalInt(r.cook_minutes ?? r.cookMinutes),
    servings: parseServings(r.servings),
    is_favorite: false,
    source: 'ai',
  };

  const parsed = ExtractedRecipeDraftSchema.safeParse(draft);
  return parsed.success ? parsed.data : { ...base, name: draft.name };
}

export function mapSchemaOrgRecipe(
  item: Record<string, unknown>,
): ExtractedRecipeDraft | null {
  const types = getObjectSchemaTypes(item);
  if (!types.includes('Recipe')) return null;

  const name =
    typeof item.name === 'string' && item.name.trim() ? item.name.trim() : null;
  if (!name) return null;

  const keywords =
    typeof item.keywords === 'string'
      ? item.keywords
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean)
      : stringList(item.keywords);

  const cuisine = stringList(item.recipeCuisine);
  const category = stringList(item.recipeCategory);
  const tags = [...cuisine, ...category, ...keywords]
    .map((tag) => tag.slice(0, 40))
    .filter(Boolean)
    .slice(0, 20);

  return normalizeExtractedRecipeDraft({
    name,
    description: typeof item.description === 'string' ? item.description : null,
    ingredients: stringList(item.recipeIngredient),
    instructions: item.recipeInstructions,
    tags,
    meal_type: normalizeMealType(category[0] ?? cuisine[0]),
    prep_minutes: isoDurationToMinutes(item.prepTime),
    cook_minutes: isoDurationToMinutes(item.cookTime),
    servings: parseServings(item.recipeYield),
  });
}

export function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function isPrivateOrLocalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return true;
    }

    const host = parsed.hostname.toLowerCase();

    // Named loopback / reserved hostnames
    if (
      host === 'localhost' ||
      host === '0.0.0.0' ||
      host.endsWith('.local') ||
      host.endsWith('.internal')
    ) {
      return true;
    }

    // IPv6 — bracket form is what URL.hostname returns, e.g. "[::1]"
    if (host.startsWith('[') && host.endsWith(']')) {
      const ipv6 = host.slice(1, -1);
      if (
        ipv6 === '::1' ||
        ipv6.startsWith('fe80') || // link-local fe80::/10
        ipv6.startsWith('fc') || // ULA fc00::/7
        ipv6.startsWith('fd') || // ULA fc00::/7
        ipv6.startsWith('::ffff:') // IPv4-mapped
      ) {
        return true;
      }
    }

    // Dotted-decimal IPv4
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      const [a, b] = host.split('.').map(Number);
      if (a === 10 || a === 127 || a === 0) return true;
      if (a === 169 && b === 254) return true;
      if (a === 192 && b === 168) return true;
      if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
      return false;
    }

    // Non-standard IP encodings: decimal (2130706433) or hex (0x7f000001).
    // Node's fetch resolves these to real IPs — reject unconditionally.
    if (/^\d+$/.test(host) || /^0x[\da-f]+$/i.test(host)) {
      return true;
    }

    return false;
  } catch {
    return true;
  }
}

export function isInstagramRecipeUrl(url: string): boolean {
  try {
    const parsed = new URL(normalizeUrl(url.trim()));
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (host !== 'instagram.com' && host !== 'instagr.am') return false;
    return /^\/(p|reel|tv)\//i.test(parsed.pathname);
  } catch {
    return false;
  }
}
