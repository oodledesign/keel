import type { CheerioAPI } from 'cheerio';

export type PageJsonLd = {
  schemaTypes: string[];
  schemaObjects: Record<string, unknown>[];
  parseErrors: string[];
  scriptTagCount: number;
};

function normaliseSchemaType(type: string): string {
  return type
    .replace(/^https?:\/\/schema\.org\//i, '')
    .replace(/^schema:/i, '')
    .trim();
}

function collectTypes(item: Record<string, unknown>, types: Set<string>) {
  const typeValue = item['@type'];
  if (Array.isArray(typeValue)) {
    for (const entry of typeValue) {
      if (entry) types.add(normaliseSchemaType(String(entry)));
    }
  } else if (typeValue) {
    types.add(normaliseSchemaType(String(typeValue)));
  }
}

function expandJsonLdItems(
  parsed: Record<string, unknown>,
): Record<string, unknown>[] {
  const graph = parsed['@graph'];
  if (Array.isArray(graph)) {
    return graph.filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === 'object' && !Array.isArray(item),
    );
  }

  return [parsed];
}

export function extractPageJsonLd($: CheerioAPI): PageJsonLd {
  const types = new Set<string>();
  const objects: Record<string, unknown>[] = [];
  const parseErrors: string[] = [];
  let scriptTagCount = 0;

  $('script[type="application/ld+json"]').each((index, el) => {
    scriptTagCount += 1;

    try {
      const raw = $(el).html()?.trim();
      if (!raw) {
        parseErrors.push(`JSON-LD block ${index + 1} is empty`);
        return;
      }

      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const items = expandJsonLdItems(parsed);

      for (const item of items) {
        objects.push(item);
        collectTypes(item, types);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Invalid JSON-LD syntax';
      parseErrors.push(`JSON-LD block ${index + 1}: ${message}`);
    }
  });

  return {
    schemaTypes: [...types].sort(),
    schemaObjects: objects,
    parseErrors,
    scriptTagCount,
  };
}

export function getObjectSchemaTypes(item: Record<string, unknown>): string[] {
  const typeValue = item['@type'];
  if (Array.isArray(typeValue)) {
    return typeValue
      .map((entry) => normaliseSchemaType(String(entry)))
      .filter(Boolean);
  }
  if (typeValue) {
    return [normaliseSchemaType(String(typeValue))];
  }
  return [];
}

export function hasNonEmptyField(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as object).length > 0;
  return true;
}
