import type { WipWorkType } from '~/lib/commercial/wip-work-type';

export const BRACKETTS_WIP_IMPORT_SOURCE = 'bracketts_wip_csv_202605';

export type BrackettsWipStage =
  | 'potential'
  | 'current'
  | 'under_offer_negotiating'
  | 'completed_exchanged'
  | 'fallen_through';

export type ParsedChaseNote = {
  /** ISO date when parseable; else null (import with deal.created_at). */
  dateIso: string | null;
  /** Raw date token from the sheet (e.g. 18.06). */
  dateRaw: string | null;
  authorToken: string | null;
  body: string;
  importKey: string;
};

export type ParsedWipInstruction = {
  /** Stable key for idempotent re-import. */
  importKey: string;
  title: string;
  /** Extra property-line context (AML etc.) kept on the deal notes field. */
  propertyMeta: string | null;
  feeGbp: number | null;
  stage: BrackettsWipStage;
  workType: WipWorkType;
  section: string;
  /** Child lines under a portfolio parent (become notes/tasks). */
  childLabels: string[];
  chaseNotes: ParsedChaseNote[];
  rawRowIndex: number;
};

type SectionRule = {
  match: RegExp;
  stage: BrackettsWipStage;
  workType: WipWorkType;
  /** When true, following non-section headers become portfolio parents. */
  portfolioMode?: boolean;
};

const SECTION_RULES: SectionRule[] = [
  {
    match: /^professional\s*&\s*mi\s*billed$/i,
    stage: 'completed_exchanged',
    workType: 'professional',
  },
  {
    match: /^professional$/i,
    stage: 'current',
    workType: 'professional',
  },
  {
    match: /^agency\s*billed$/i,
    stage: 'completed_exchanged',
    workType: 'agency',
  },
  {
    match: /under\s*offer/i,
    stage: 'under_offer_negotiating',
    workType: 'agency',
  },
  {
    match: /^offer\s*received/i,
    stage: 'under_offer_negotiating',
    workType: 'agency',
  },
  {
    match: /negotiat|negotat/i,
    stage: 'under_offer_negotiating',
    workType: 'agency',
  },
  {
    match: /^instructions$/i,
    stage: 'current',
    workType: 'agency',
  },
  {
    match: /^instructed/i,
    stage: 'current',
    workType: 'agency',
  },
  {
    match: /^reported/i,
    stage: 'potential',
    workType: 'agency',
  },
  {
    match: /^potential/i,
    stage: 'potential',
    workType: 'agency',
  },
  {
    match: /^valuation$/i,
    stage: 'potential',
    workType: 'professional',
  },
  {
    match: /^on\s*hold$/i,
    stage: 'potential',
    workType: 'agency',
  },
  {
    match: /^no\s*\/?\s*no\s*feedback$/i,
    stage: 'potential',
    workType: 'agency',
  },
  {
    match: /^management$/i,
    stage: 'current',
    workType: 'management',
    portfolioMode: true,
  },
  {
    match: /^2027\s*\/\s*2028$/i,
    stage: 'under_offer_negotiating',
    workType: 'agency',
  },
];

const SKIP_SECTION = /^(2026-2027|total|billed|u\/o|property|test)$/i;

const AUTHOR_ALIASES: Record<string, string> = {
  dt: 'DT',
  job: 'JOB',
  josh: 'JOB',
  am: 'AM',
  db: 'DB',
  ed: 'ED',
  dal: 'DAL',
  st: 'ST',
  mc: 'MC',
  pm: 'PM',
};

/** Known people for Bracketts import (emails may already be invited). */
export const BRACKETTS_AUTHOR_DIRECTORY: Array<{
  token: string;
  name: string;
  emails: string[];
}> = [
  {
    token: 'DT',
    name: 'Dominic Tomlinson',
    emails: [
      'dominic.tomlinson@bracketts.co.uk',
      'dominic.tomlinson@bracektts.co.uk',
    ],
  },
  {
    token: 'AM',
    name: 'Abbey Mitchell',
    emails: ['abbey.mitchell@bracketts.co.uk'],
  },
  {
    token: 'DB',
    name: 'Darrell Barber',
    emails: ['darrell@bracketts.co.uk'],
  },
  {
    token: 'JOB',
    name: "Josh O'Brien",
    emails: ["joshua.o'brien@bracketts.co.uk", 'joshua.obrien@bracketts.co.uk'],
  },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function isManagementChildLabel(title: string) {
  return /^(asbestos|eicr|epc|fra|rates|utilities|service\s*charge|measured\s*survey)$/i.test(
    title.trim(),
  );
}

function parseFeeGbp(raw: string): number | null {
  const cleaned = raw.replace(/[£,\s]/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function splitPropertyCell(raw: string): { title: string; meta: string | null } {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const title = lines[0] ?? raw.trim();
  const meta = lines.slice(1).join('\n').trim() || null;
  return { title: title.replace(/\s+/g, ' ').trim(), meta };
}

function normalizeAuthorToken(raw: string | null): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (!key || key.length > 12) return null;
  if (AUTHOR_ALIASES[key]) return AUTHOR_ALIASES[key];
  if (/^(dt|am|db|job|josh|ed|dal|st|mc)$/i.test(key)) {
    return key.toLowerCase() === 'josh' ? 'JOB' : key.toUpperCase();
  }
  return null;
}

/**
 * Parse dated chase lines from Bracketts sheet note cells.
 * Example: `18.06 Dt chased for an update`
 */
export function parseChaseNotes(
  notesRaw: string,
  instructionImportKey: string,
  defaultYear = 2025,
): ParsedChaseNote[] {
  const text = notesRaw.replace(/\r\n/g, '\n').trim();
  if (!text) return [];

  const lineRe =
    /(?:^|\n)\s*(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\s+([^\n]+)/g;
  const out: ParsedChaseNote[] = [];
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = lineRe.exec(text)) != null) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const yearRaw = match[3];
    const rest = (match[4] ?? '').trim();
    if (!rest || day < 1 || day > 31 || month < 1 || month > 12) continue;

    let year = defaultYear;
    if (yearRaw) {
      year = yearRaw.length === 2 ? 2000 + Number(yearRaw) : Number(yearRaw);
    }

    const authorMatch = rest.match(/^([A-Za-z]{1,12})\b/);
    const authorToken = normalizeAuthorToken(authorMatch?.[1] ?? null);
    const body = authorToken
      ? rest.slice(authorMatch![1]!.length).trim() || rest
      : rest;

    const dateIso = Number.isFinite(year)
      ? new Date(Date.UTC(year, month - 1, day)).toISOString()
      : null;
    const dateRaw = `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}${yearRaw ? `.${yearRaw}` : ''}`;

    out.push({
      dateIso,
      dateRaw,
      authorToken,
      body,
      importKey: `${instructionImportKey}:note:${idx}:${dateRaw}:${slugify(body).slice(0, 40)}`,
    });
    idx += 1;
  }

  if (out.length === 0 && text) {
    out.push({
      dateIso: null,
      dateRaw: null,
      authorToken: null,
      body: text,
      importKey: `${instructionImportKey}:note:0:undated:${slugify(text).slice(0, 40)}`,
    });
  }

  return out;
}

function resolveSection(label: string): SectionRule | null {
  const trimmed = label.trim();
  if (!trimmed || SKIP_SECTION.test(trimmed)) return null;
  for (const rule of SECTION_RULES) {
    if (rule.match.test(trimmed)) return rule;
  }
  return null;
}

type FlatRow = {
  rowIndex: number;
  prop: string;
  notes: string;
  fee: string;
};

/**
 * Parse Bracketts WIP sheet rows (CSV already decoded).
 * Col layout: [0 unused], [1] property/section, [2] chase notes, [3] fee.
 */
export function parseBrackettsWipCsvRows(
  rows: string[][],
  options?: { defaultNoteYear?: number },
): ParsedWipInstruction[] {
  const defaultNoteYear = options?.defaultNoteYear ?? 2025;
  const flat: FlatRow[] = rows.map((r, rowIndex) => ({
    rowIndex,
    prop: (r[1] ?? '').trim(),
    notes: (r[2] ?? '').trim(),
    fee: (r[3] ?? '').trim(),
  }));

  type Ctx = {
    stage: BrackettsWipStage;
    workType: WipWorkType;
    section: string;
    portfolioMode: boolean;
  };

  let ctx: Ctx = {
    stage: 'current',
    workType: 'agency',
    section: 'Unsectioned',
    portfolioMode: false,
  };

  const instructions: ParsedWipInstruction[] = [];
  let openPortfolio: ParsedWipInstruction | null = null;

  const closePortfolio = () => {
    openPortfolio = null;
  };

  for (const row of flat) {
    if (!row.prop) continue;

    // Section headers win even when the sheet put a note in the chase column
    // (e.g. "Management" + "ALL REINSTATEMENT").
    const sectionRule = resolveSection(row.prop);
    if (sectionRule) {
      closePortfolio();
      ctx = {
        stage: sectionRule.stage,
        workType: sectionRule.workType,
        section: row.prop.trim(),
        portfolioMode: Boolean(sectionRule.portfolioMode),
      };
      continue;
    }

    if (SKIP_SECTION.test(row.prop) && !row.notes && !row.fee) {
      closePortfolio();
      continue;
    }

    const isEmptyRow = !row.notes && !row.fee;
    const looksLikePortfolioParent =
      /\b(overall|portfolio|inspections?)\b/i.test(row.prop) ||
      ctx.portfolioMode;

    if (isEmptyRow && looksLikePortfolioParent) {
      const { title, meta } = splitPropertyCell(row.prop);

      // Under Management, short service lines stay on the open parent;
      // other empty headers start a new portfolio group.
      if (
        openPortfolio &&
        ctx.portfolioMode &&
        isManagementChildLabel(title)
      ) {
        openPortfolio.childLabels.push(meta ? `${title} — ${meta}` : title);
        continue;
      }

      closePortfolio();
      const importKey = `${BRACKETTS_WIP_IMPORT_SOURCE}:portfolio:${row.rowIndex}:${slugify(title)}`;
      openPortfolio = {
        importKey,
        title,
        propertyMeta: meta,
        feeGbp: null,
        stage: ctx.stage,
        workType: ctx.portfolioMode ? 'management' : ctx.workType,
        section: `${ctx.section} › ${title}`,
        childLabels: [],
        chaseNotes: [],
        rawRowIndex: row.rowIndex,
      };
      instructions.push(openPortfolio);
      continue;
    }

    // Data row (may have empty notes/fee — still an instruction)
    if (openPortfolio && ctx.portfolioMode) {
      const { title, meta } = splitPropertyCell(row.prop);

      // A management row with chase notes that isn't a service child is its
      // own instruction (e.g. property inspections), not a Nazeing child.
      if (!isManagementChildLabel(title) && !isEmptyRow) {
        closePortfolio();
        const importKey = `${BRACKETTS_WIP_IMPORT_SOURCE}:row:${row.rowIndex}:${slugify(title)}`;
        instructions.push({
          importKey,
          title,
          propertyMeta: meta,
          feeGbp: parseFeeGbp(row.fee),
          stage: ctx.stage,
          workType: 'management',
          section: ctx.section,
          childLabels: [],
          chaseNotes: parseChaseNotes(row.notes, importKey, defaultNoteYear),
          rawRowIndex: row.rowIndex,
        });
        continue;
      }

      const label = meta ? `${title} — ${meta}` : title;
      openPortfolio.childLabels.push(label);
      if (row.notes) {
        openPortfolio.chaseNotes.push(
          ...parseChaseNotes(
            row.notes,
            `${openPortfolio.importKey}:child:${slugify(title)}`,
            defaultNoteYear,
          ),
        );
      }
      if (row.fee) {
        const fee = parseFeeGbp(row.fee);
        if (fee != null) {
          openPortfolio.feeGbp = (openPortfolio.feeGbp ?? 0) + fee;
        }
      }
      continue;
    }

    // Leaving portfolio mode context when we hit a normal instruction
    if (openPortfolio && !ctx.portfolioMode) {
      closePortfolio();
    }

    const { title, meta } = splitPropertyCell(row.prop);
    if (/^property$/i.test(title) || /^total$/i.test(title)) continue;

    const importKey = `${BRACKETTS_WIP_IMPORT_SOURCE}:row:${row.rowIndex}:${slugify(title)}`;
    instructions.push({
      importKey,
      title,
      propertyMeta: meta,
      feeGbp: parseFeeGbp(row.fee),
      stage: ctx.stage,
      workType: ctx.workType,
      section: ctx.section,
      childLabels: [],
      chaseNotes: parseChaseNotes(row.notes, importKey, defaultNoteYear),
      rawRowIndex: row.rowIndex,
    });
  }

  return instructions;
}

export function normalizeMatchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(aml|done|the|and|inc|ltd|limited)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** RFC-style CSV parse that keeps newlines inside quoted fields. */
export function parseCsvMultiline(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      row.push(cur);
      cur = '';
      continue;
    }
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cur);
      cur = '';
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      continue;
    }
    cur += ch;
  }

  row.push(cur);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

export function fuzzyListingScore(a: string, b: string): number {
  const na = normalizeMatchText(a);
  const nb = normalizeMatchText(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const numA = new Set(
    (na.match(/\b\d+[a-z]?\b/g) ?? []).map((n) => n.toLowerCase()),
  );
  const numB = new Set(
    (nb.match(/\b\d+[a-z]?\b/g) ?? []).map((n) => n.toLowerCase()),
  );
  if (numA.size > 0 && numB.size > 0) {
    let numHit = false;
    for (const n of numA) if (numB.has(n)) numHit = true;
    if (!numHit) return 0;
  }

  // Substring match only when both sides are reasonably specific
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  if (
    shorter.length >= 12 &&
    shorter.split(' ').length >= 2 &&
    longer.includes(shorter)
  ) {
    return 0.9;
  }

  const ta = new Set(na.split(' ').filter((t) => t.length > 1));
  const tb = new Set(nb.split(' ').filter((t) => t.length > 1));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = new Set([...ta, ...tb]).size;
  const jaccard = inter / union;
  if (inter >= 3) return Math.max(jaccard, 0.75);
  if (inter >= 2 && jaccard >= 0.5) return Math.max(jaccard, 0.6);
  return jaccard;
}

export type ListingMatchCandidate = {
  id: string;
  name: string;
  score: number;
};

export function rankListingMatches(
  title: string,
  listings: Array<{ id: string; name: string }>,
  limit = 3,
): ListingMatchCandidate[] {
  return listings
    .map((listing) => ({
      id: listing.id,
      name: listing.name,
      score: fuzzyListingScore(title, listing.name),
    }))
    .filter((row) => row.score >= 0.45)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
