/** Site Studio website brief (Prompt A2) — schemaVersion 1.0. */

export const WEBSITE_BRIEF_SCHEMA_VERSION = '1.0' as const;

export type WebsiteBriefStackPreference =
  | 'webflow'
  | 'astro'
  | 'next'
  | 'ozer_sites'
  | 'undecided';

export type WebsiteBriefService = {
  id: string;
  name: string;
  description: string;
};

export type WebsiteBriefAudienceSegment = {
  id: string;
  name: string;
  jobsToBeDone: string;
  objections: string[];
};

export type WebsiteBriefCompetitor = {
  id: string;
  name: string;
  url: string;
  notes: string;
};

export type WebsiteBriefReference = {
  id: string;
  url: string;
  whyThisWorks: string;
};

export type WebsiteBrief = {
  schemaVersion: typeof WEBSITE_BRIEF_SCHEMA_VERSION;
  org: {
    name: string;
    oneLiner: string;
    sector: string;
    geography: string;
  };
  brand: {
    tone: string[];
    constraints: string[];
    existingSiteUrl?: string;
  };
  offer: {
    services: WebsiteBriefService[];
    primaryConversionGoals: string[];
  };
  audience: {
    segments: WebsiteBriefAudienceSegment[];
  };
  conversation: {
    questionsTheSiteMustAnswer: string[];
  };
  competitors: WebsiteBriefCompetitor[];
  references: WebsiteBriefReference[];
  stackPreference: WebsiteBriefStackPreference;
};

export type BriefAiSource = 'notes' | 'url' | 'crm';

export type BriefFieldProvenanceStatus =
  | 'suggested'
  | 'confirmed'
  | 'human_edited';

export type BriefFieldProvenance = {
  source: BriefAiSource;
  model: string;
  suggestedAt: string;
  status: BriefFieldProvenanceStatus;
};

export type WebsiteBriefAiProvenance = {
  fields: Record<string, BriefFieldProvenance>;
  lastRun?: {
    source: BriefAiSource;
    extractModel: string;
    synthesizeModel: string;
    at: string;
  };
};

/** Leaf / section paths tracked for AI provenance + delta saves. */
export const BRIEF_FIELD_PATHS = [
  'org.name',
  'org.oneLiner',
  'org.sector',
  'org.geography',
  'brand.tone',
  'brand.constraints',
  'brand.existingSiteUrl',
  'offer.services',
  'offer.primaryConversionGoals',
  'audience.segments',
  'conversation.questionsTheSiteMustAnswer',
  'competitors',
  'references',
  'stackPreference',
] as const;

export type BriefFieldPath = (typeof BRIEF_FIELD_PATHS)[number];

export type BriefSectionKey =
  | 'org'
  | 'brand'
  | 'offer'
  | 'audience'
  | 'conversation'
  | 'competitors'
  | 'references'
  | 'stack';

export const BRIEF_SECTIONS: Array<{
  key: BriefSectionKey;
  label: string;
  paths: BriefFieldPath[];
}> = [
  {
    key: 'org',
    label: 'Organisation',
    paths: ['org.name', 'org.oneLiner', 'org.sector', 'org.geography'],
  },
  {
    key: 'brand',
    label: 'Brand',
    paths: ['brand.tone', 'brand.constraints', 'brand.existingSiteUrl'],
  },
  {
    key: 'offer',
    label: 'Offer',
    paths: ['offer.services', 'offer.primaryConversionGoals'],
  },
  {
    key: 'audience',
    label: 'Audience',
    paths: ['audience.segments'],
  },
  {
    key: 'conversation',
    label: 'Conversation',
    paths: ['conversation.questionsTheSiteMustAnswer'],
  },
  {
    key: 'competitors',
    label: 'Competitors',
    paths: ['competitors'],
  },
  {
    key: 'references',
    label: 'References',
    paths: ['references'],
  },
  {
    key: 'stack',
    label: 'Stack',
    paths: ['stackPreference'],
  },
];

export function emptyWebsiteBrief(): WebsiteBrief {
  return {
    schemaVersion: WEBSITE_BRIEF_SCHEMA_VERSION,
    org: { name: '', oneLiner: '', sector: '', geography: '' },
    brand: { tone: [], constraints: [], existingSiteUrl: '' },
    offer: { services: [], primaryConversionGoals: [] },
    audience: { segments: [] },
    conversation: { questionsTheSiteMustAnswer: [] },
    competitors: [],
    references: [],
    stackPreference: 'undecided',
  };
}

export function emptyBriefAiProvenance(): WebsiteBriefAiProvenance {
  return { fields: {} };
}

export function newBriefItemId(): string {
  return crypto.randomUUID();
}

export function isBriefValueEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (typeof value === 'boolean' || typeof value === 'number') return false;
  if (Array.isArray(value)) {
    return value.length === 0 || value.every(isBriefValueEmpty);
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).every(
      isBriefValueEmpty,
    );
  }
  return false;
}

export function getBriefPathValue(brief: WebsiteBrief, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = brief;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function setBriefPathValue(
  brief: WebsiteBrief,
  path: string,
  value: unknown,
): WebsiteBrief {
  const parts = path.split('.');
  const clone = structuredClone(brief) as WebsiteBrief;
  let cursor: Record<string, unknown> = clone as unknown as Record<
    string,
    unknown
  >;

  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    const next = cursor[key];
    if (next == null || typeof next !== 'object') {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }

  cursor[parts[parts.length - 1]!] = value;
  clone.schemaVersion = WEBSITE_BRIEF_SCHEMA_VERSION;
  return clone;
}

/** Deep-merge a sparse patch onto a brief (arrays replace when present). */
export function applyBriefPatch(
  current: WebsiteBrief,
  patch: Record<string, unknown>,
): WebsiteBrief {
  const next = structuredClone(current) as WebsiteBrief;

  function merge(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
  ) {
    for (const [key, value] of Object.entries(source)) {
      if (value === undefined) continue;
      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        typeof target[key] === 'object' &&
        target[key] !== null &&
        !Array.isArray(target[key])
      ) {
        merge(
          target[key] as Record<string, unknown>,
          value as Record<string, unknown>,
        );
      } else {
        target[key] = value;
      }
    }
  }

  merge(next as unknown as Record<string, unknown>, patch);
  next.schemaVersion = WEBSITE_BRIEF_SCHEMA_VERSION;
  return next;
}

export function sectionCompleteness(
  brief: WebsiteBrief,
  sectionKey: BriefSectionKey,
): { filled: number; total: number; ratio: number } {
  const section = BRIEF_SECTIONS.find((item) => item.key === sectionKey);
  if (!section) return { filled: 0, total: 0, ratio: 0 };

  const total = section.paths.length;
  const filled = section.paths.filter(
    (path) => !isBriefValueEmpty(getBriefPathValue(brief, path)),
  ).length;

  return { filled, total, ratio: total === 0 ? 0 : filled / total };
}

export function overallBriefCompleteness(brief: WebsiteBrief): number {
  const totals = BRIEF_SECTIONS.map((section) =>
    sectionCompleteness(brief, section.key),
  );
  const filled = totals.reduce((sum, item) => sum + item.filled, 0);
  const total = totals.reduce((sum, item) => sum + item.total, 0);
  return total === 0 ? 0 : filled / total;
}

const STACK_VALUES = new Set<WebsiteBriefStackPreference>([
  'webflow',
  'astro',
  'next',
  'ozer_sites',
  'undecided',
]);

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

type LegacyFlatBrief = {
  orgName?: string;
  brandSummary?: string;
  offer?: string;
  audience?: string;
  geography?: string;
  jobsToBeDone?: string;
  objections?: string;
  competitors?: string;
  references?: Array<{ url?: string; why?: string; whyThisWorks?: string }>;
  tone?: string;
  constraints?: string;
  conversionGoals?: string;
  targetStack?: string;
  cmsNeeded?: boolean;
  schemaVersion?: string;
};

/**
 * Normalise stored JSON (v1 or legacy flat) into WebsiteBrief 1.0.
 */
export function normalizeWebsiteBrief(raw: unknown): WebsiteBrief {
  const empty = emptyWebsiteBrief();
  if (!raw || typeof raw !== 'object') return empty;

  const data = raw as Record<string, unknown>;

  if (data.schemaVersion === WEBSITE_BRIEF_SCHEMA_VERSION || data.org) {
    const org = (data.org ?? {}) as Record<string, unknown>;
    const brand = (data.brand ?? {}) as Record<string, unknown>;
    const offer = (data.offer ?? {}) as Record<string, unknown>;
    const audience = (data.audience ?? {}) as Record<string, unknown>;
    const conversation = (data.conversation ?? {}) as Record<string, unknown>;

    const stack = String(
      data.stackPreference ?? empty.stackPreference,
    ) as WebsiteBriefStackPreference;

    return {
      schemaVersion: WEBSITE_BRIEF_SCHEMA_VERSION,
      org: {
        name: String(org.name ?? ''),
        oneLiner: String(org.oneLiner ?? ''),
        sector: String(org.sector ?? ''),
        geography: String(org.geography ?? ''),
      },
      brand: {
        tone: asStringArray(brand.tone),
        constraints: asStringArray(brand.constraints),
        existingSiteUrl: String(brand.existingSiteUrl ?? ''),
      },
      offer: {
        services: Array.isArray(offer.services)
          ? offer.services.map((item) => {
              const row = (item ?? {}) as Record<string, unknown>;
              return {
                id: String(row.id ?? newBriefItemId()),
                name: String(row.name ?? ''),
                description: String(row.description ?? ''),
              };
            })
          : [],
        primaryConversionGoals: asStringArray(offer.primaryConversionGoals),
      },
      audience: {
        segments: Array.isArray(audience.segments)
          ? audience.segments.map((item) => {
              const row = (item ?? {}) as Record<string, unknown>;
              return {
                id: String(row.id ?? newBriefItemId()),
                name: String(row.name ?? ''),
                jobsToBeDone: String(row.jobsToBeDone ?? ''),
                objections: asStringArray(row.objections),
              };
            })
          : [],
      },
      conversation: {
        questionsTheSiteMustAnswer: asStringArray(
          conversation.questionsTheSiteMustAnswer,
        ),
      },
      competitors: Array.isArray(data.competitors)
        ? (data.competitors as unknown[]).map((item) => {
            const row = (item ?? {}) as Record<string, unknown>;
            return {
              id: String(row.id ?? newBriefItemId()),
              name: String(row.name ?? ''),
              url: String(row.url ?? ''),
              notes: String(row.notes ?? ''),
            };
          })
        : [],
      references: Array.isArray(data.references)
        ? (data.references as unknown[])
            .map((item) => {
              const row = (item ?? {}) as Record<string, unknown>;
              return {
                id: String(row.id ?? newBriefItemId()),
                url: String(row.url ?? ''),
                whyThisWorks: String(row.whyThisWorks ?? row.why ?? ''),
              };
            })
            .slice(0, 20)
        : [],
      stackPreference: STACK_VALUES.has(stack) ? stack : 'undecided',
    };
  }

  // Legacy flat Shape used before Prompt A2.
  const legacy = data as LegacyFlatBrief;
  const objections = asStringArray(legacy.objections);
  const goals = asStringArray(legacy.conversionGoals);

  return {
    schemaVersion: WEBSITE_BRIEF_SCHEMA_VERSION,
    org: {
      name: String(legacy.orgName ?? ''),
      oneLiner: String(legacy.brandSummary ?? ''),
      sector: '',
      geography: String(legacy.geography ?? ''),
    },
    brand: {
      tone: asStringArray(legacy.tone),
      constraints: asStringArray(legacy.constraints),
      existingSiteUrl: '',
    },
    offer: {
      services: legacy.offer
        ? [
            {
              id: newBriefItemId(),
              name: 'Core offer',
              description: String(legacy.offer),
            },
          ]
        : [],
      primaryConversionGoals: goals,
    },
    audience: {
      segments:
        legacy.audience || legacy.jobsToBeDone || objections.length
          ? [
              {
                id: newBriefItemId(),
                name: String(legacy.audience ?? 'Primary audience'),
                jobsToBeDone: String(legacy.jobsToBeDone ?? ''),
                objections,
              },
            ]
          : [],
    },
    conversation: { questionsTheSiteMustAnswer: [] },
    competitors: legacy.competitors
      ? [
          {
            id: newBriefItemId(),
            name: String(legacy.competitors).slice(0, 200),
            url: '',
            notes: String(legacy.competitors),
          },
        ]
      : [],
    references: Array.isArray(legacy.references)
      ? legacy.references.map((ref) => ({
          id: newBriefItemId(),
          url: String(ref.url ?? ''),
          whyThisWorks: String(ref.whyThisWorks ?? ref.why ?? ''),
        }))
      : [],
    stackPreference: STACK_VALUES.has(
      legacy.targetStack as WebsiteBriefStackPreference,
    )
      ? (legacy.targetStack as WebsiteBriefStackPreference)
      : 'undecided',
  };
}

export function normalizeBriefAiProvenance(
  raw: unknown,
): WebsiteBriefAiProvenance {
  if (!raw || typeof raw !== 'object') return emptyBriefAiProvenance();
  const data = raw as Record<string, unknown>;
  const fieldsRaw =
    data.fields && typeof data.fields === 'object'
      ? (data.fields as Record<string, unknown>)
      : {};

  const fields: WebsiteBriefAiProvenance['fields'] = {};
  for (const [path, value] of Object.entries(fieldsRaw)) {
    if (!value || typeof value !== 'object') continue;
    const row = value as Record<string, unknown>;
    const source = row.source;
    if (source !== 'notes' && source !== 'url' && source !== 'crm') continue;
    const status = row.status;
    fields[path] = {
      source,
      model: String(row.model ?? ''),
      suggestedAt: String(row.suggestedAt ?? ''),
      status:
        status === 'confirmed' || status === 'human_edited'
          ? status
          : 'suggested',
    };
  }

  const lastRunRaw = data.lastRun;
  let lastRun: WebsiteBriefAiProvenance['lastRun'];
  if (lastRunRaw && typeof lastRunRaw === 'object') {
    const row = lastRunRaw as Record<string, unknown>;
    if (
      row.source === 'notes' ||
      row.source === 'url' ||
      row.source === 'crm'
    ) {
      lastRun = {
        source: row.source,
        extractModel: String(row.extractModel ?? ''),
        synthesizeModel: String(row.synthesizeModel ?? ''),
        at: String(row.at ?? ''),
      };
    }
  }

  return { fields, lastRun };
}

/**
 * Merge AI suggestion into the current brief without overwriting human fields
 * unless the path is listed in `confirmOverwritePaths`.
 *
 * Human-owned = non-empty with no provenance, or status human_edited.
 * Prior AI suggestions may be replaced on re-run without confirmation.
 */
export function mergeBriefSuggestion(params: {
  current: WebsiteBrief;
  suggested: WebsiteBrief;
  source: BriefAiSource;
  model: string;
  provenance: WebsiteBriefAiProvenance;
  confirmOverwritePaths?: string[];
}): {
  brief: WebsiteBrief;
  provenance: WebsiteBriefAiProvenance;
  appliedPaths: string[];
  skippedPaths: string[];
} {
  const confirm = new Set(params.confirmOverwritePaths ?? []);
  const appliedPaths: string[] = [];
  const skippedPaths: string[] = [];
  let brief = params.current;
  const provenance = {
    ...params.provenance,
    fields: { ...params.provenance.fields },
  };
  const suggestedAt = new Date().toISOString();

  for (const path of BRIEF_FIELD_PATHS) {
    const nextValue = getBriefPathValue(params.suggested, path);
    if (isBriefValueEmpty(nextValue)) continue;

    const currentValue = getBriefPathValue(brief, path);
    const existing = provenance.fields[path];
    const isHumanOwned =
      !isBriefValueEmpty(currentValue) &&
      (!existing || existing.status === 'human_edited');

    if (isHumanOwned && !confirm.has(path)) {
      skippedPaths.push(path);
      continue;
    }

    brief = setBriefPathValue(brief, path, nextValue);
    provenance.fields[path] = {
      source: params.source,
      model: params.model,
      suggestedAt,
      status: 'suggested',
    };
    appliedPaths.push(path);
  }

  return { brief, provenance, appliedPaths, skippedPaths };
}

export function markBriefPathsHumanEdited(
  provenance: WebsiteBriefAiProvenance,
  paths: string[],
): WebsiteBriefAiProvenance {
  const fields = { ...provenance.fields };
  for (const path of paths) {
    const existing = fields[path];
    if (existing) {
      fields[path] = { ...existing, status: 'human_edited' };
    }
  }
  return { ...provenance, fields };
}

export function confirmBriefAiPaths(
  provenance: WebsiteBriefAiProvenance,
  paths: string[],
): WebsiteBriefAiProvenance {
  const fields = { ...provenance.fields };
  for (const path of paths) {
    const existing = fields[path];
    if (existing && existing.status === 'suggested') {
      fields[path] = { ...existing, status: 'confirmed' };
    }
  }
  return { ...provenance, fields };
}

/** Plain-text context block for downstream Site Studio AI prompts. */
export function briefContextText(brief: WebsiteBrief | null): string {
  if (!brief) return 'No structured brief captured yet.';

  const services = brief.offer.services
    .map((service) => `- ${service.name}: ${service.description}`)
    .join('\n');
  const segments = brief.audience.segments
    .map(
      (segment) =>
        `- ${segment.name}: JTBD ${segment.jobsToBeDone}; objections: ${segment.objections.join('; ') || 'n/a'}`,
    )
    .join('\n');
  const competitors = brief.competitors
    .map((row) => `- ${row.name} (${row.url}): ${row.notes}`)
    .join('\n');
  const references = brief.references
    .map((ref) => `- ${ref.url} — ${ref.whyThisWorks}`)
    .join('\n');

  return [
    `Organisation: ${brief.org.name || 'n/a'}`,
    `One-liner: ${brief.org.oneLiner || 'n/a'}`,
    `Sector: ${brief.org.sector || 'n/a'}`,
    `Geography: ${brief.org.geography || 'n/a'}`,
    `Tone: ${brief.brand.tone.join(', ') || 'n/a'}`,
    `Constraints: ${brief.brand.constraints.join(', ') || 'n/a'}`,
    brief.brand.existingSiteUrl
      ? `Existing site: ${brief.brand.existingSiteUrl}`
      : null,
    `Services:\n${services || '- none'}`,
    `Conversion goals: ${brief.offer.primaryConversionGoals.join('; ') || 'n/a'}`,
    `Audience segments:\n${segments || '- none'}`,
    `Questions the site must answer:\n${brief.conversation.questionsTheSiteMustAnswer.map((q) => `- ${q}`).join('\n') || '- none'}`,
    `Competitors:\n${competitors || '- none'}`,
    `References:\n${references || '- none'}`,
    `Stack preference: ${brief.stackPreference}`,
  ]
    .filter(Boolean)
    .join('\n');
}
