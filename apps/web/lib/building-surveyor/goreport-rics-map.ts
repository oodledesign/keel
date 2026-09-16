import {
  type BuildingSurveySection,
  buildingSurveySectionByRicsCode,
} from './rics-catalogue';

export type GoreportMappedField = {
  fieldId: string | null;
  goreportPath: string;
  ricsCode: string;
  sectionKey: string;
  letter: string;
};

const HEADER_RE = /^\((\d+)\)\s*([\s\S]+)$/;
const ELEMENT_RE = /\b([A-N])\s*([1-9])\b/i;

const FIELD_HINTS: Array<{
  test: RegExp;
  ricsCode: string;
}> = [
  { test: /\brelated party/i, ricsCode: 'A.related_party' },
  { test: /\bweather/i, ricsCode: 'A.weather' },
  { test: /\bstatus of the property/i, ricsCode: 'A.occupancy' },
  { test: /\bclient name/i, ricsCode: 'A' },
  { test: /\bfull address/i, ricsCode: 'A' },
  { test: /\bfront cover image/i, ricsCode: 'A' },
  { test: /\boverall opinion/i, ricsCode: 'B' },
  { test: /\bfurther investigations/i, ricsCode: 'B.further_investigations' },
  { test: /\bsummary of repairs/i, ricsCode: 'B.repairs' },
  { test: /\bdocuments we may suggest/i, ricsCode: 'B.documents' },
  { test: /\btype of property/i, ricsCode: 'C.type' },
  { test: /\byear the property was built/i, ricsCode: 'C.year_built' },
  { test: /\byear the property was extended/i, ricsCode: 'C.year_extended' },
  { test: /\byear the property was converted/i, ricsCode: 'C.year_converted' },
  { test: /\bflats and maisonettes/i, ricsCode: 'C.flats' },
  { test: /\bmeans of escape/i, ricsCode: 'C.means_of_escape' },
  { test: /\bissues relating to the energy/i, ricsCode: 'C.epc_issues' },
  { test: /\benergy efficiency rating/i, ricsCode: 'C.epc' },
  { test: /\bother energy matters/i, ricsCode: 'C.other_energy' },
  { test: /\bother services or energy/i, ricsCode: 'C.other_energy_sources' },
  { test: /\bconstruction\b/i, ricsCode: 'C.construction' },
  { test: /\blocation and facilities\s*>\s*grounds/i, ricsCode: 'C.grounds' },
  { test: /\blocation and facilities\s*>\s*location/i, ricsCode: 'C.location' },
  {
    test: /\blocation and facilities\s*>\s*facilities/i,
    ricsCode: 'C.facilities',
  },
  {
    test: /\blocation and facilities\s*>\s*local environment/i,
    ricsCode: 'C.local_environment',
  },
  {
    test: /\blocation and facilities\s*>\s*other local/i,
    ricsCode: 'C.other_local',
  },
  {
    test: /\boutside the property\s*>\s*limitations/i,
    ricsCode: 'D.limitations',
  },
  {
    test: /\binside the property\s*>\s*limitations/i,
    ricsCode: 'E.limitations',
  },
  { test: /\bservices\s*>\s*limitations/i, ricsCode: 'F.limitations' },
  { test: /\bgrounds[\s\S]*>\s*limitations/i, ricsCode: 'G.limitations' },
  { test: /\bvaluation\b/i, ricsCode: 'J.valuation' },
  { test: /\bnote pad\b/i, ricsCode: 'notes' },
];

function collapseWs(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function fallbackForLetter(letter: string): string {
  const map: Record<string, string> = {
    A: 'A',
    B: 'B',
    C: 'C',
    D: 'D.limitations',
    E: 'E.limitations',
    F: 'F.limitations',
    G: 'G.limitations',
    H: 'H1',
    I: 'I1',
    J: 'J.valuation',
    K: 'K',
    L: 'L',
    M: 'M',
    N: 'N',
  };
  return map[letter] ?? letter;
}

export function parseGoreportFieldHeader(raw: string): {
  fieldId: string | null;
  rest: string;
} {
  const match = HEADER_RE.exec(raw.trim());
  if (!match) {
    return { fieldId: null, rest: collapseWs(raw) };
  }
  return { fieldId: match[1] ?? null, rest: collapseWs(match[2] ?? '') };
}

export function mapGoreportPath(rawPath: string): GoreportMappedField {
  const { fieldId, rest } = parseGoreportFieldHeader(rawPath);
  const element = ELEMENT_RE.exec(rest);
  let ricsCode: string | null = null;

  if (element) {
    ricsCode = `${element[1]!.toUpperCase()}${element[2]}`;
  } else {
    for (const hint of FIELD_HINTS) {
      if (hint.test.test(rest)) {
        ricsCode = hint.ricsCode;
        break;
      }
    }
  }

  if (!ricsCode) {
    const letterMatch = /^([A-N])\b/i.exec(rest);
    ricsCode = letterMatch
      ? fallbackForLetter(letterMatch[1]!.toUpperCase())
      : 'notes';
  }

  const section: BuildingSurveySection | undefined =
    buildingSurveySectionByRicsCode(ricsCode);

  return {
    fieldId,
    goreportPath: collapseWs(rawPath),
    ricsCode,
    sectionKey: section?.key ?? 'about_inspection',
    letter: section?.letter ?? ricsCode.charAt(0),
  };
}

export function isGoreportFieldHeader(value: string): boolean {
  return HEADER_RE.test(value.trim());
}

export function isGoreportColumnHeader(value: string): boolean {
  return value.trim().toLowerCase() === 'title';
}

export function isGoreportChecksumRow(value: string): boolean {
  return value.trim().toLowerCase().startsWith('checksum:');
}
