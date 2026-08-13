/**
 * Bracketts requirements-board use-class colours (from their sheet legend).
 */

export const REQUIREMENT_USE_CLASSES = [
  'class_b',
  'class_e',
  'land',
  'investment',
  'development',
  'sui_generis',
  'pending',
] as const;

export type RequirementUseClass = (typeof REQUIREMENT_USE_CLASSES)[number];

export const REQUIREMENT_USE_CLASS_LABELS: Record<RequirementUseClass, string> =
  {
    class_b: 'Class B (Industrial)',
    class_e: 'Class E (Retail, Offices)',
    land: 'Land',
    investment: 'Investment',
    development: 'Development',
    sui_generis: 'Sui Generis',
    pending: 'Pending / in negotiations',
  };

/** Background + text for requirement cards / rows. */
export const REQUIREMENT_USE_CLASS_STYLES: Record<
  RequirementUseClass,
  { background: string; color: string }
> = {
  class_b: { background: '#FEF1D1', color: '#3D2A14' },
  class_e: { background: '#DAE8FC', color: '#1A3A5C' },
  land: { background: '#27751E', color: '#FBF6EC' },
  investment: { background: '#FAD7D7', color: '#5C1A1A' },
  development: { background: '#D5E8D4', color: '#1E3D1A' },
  sui_generis: { background: '#F9CB40', color: '#3D2A14' },
  pending: { background: '#CCCCCC', color: '#2A2A2A' },
};

export function normalizeRequirementUseClass(
  raw: string | null | undefined,
): RequirementUseClass | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase().replace(/[\s/-]+/g, '_');
  if ((REQUIREMENT_USE_CLASSES as readonly string[]).includes(key)) {
    return key as RequirementUseClass;
  }
  return inferRequirementUseClass(raw);
}

/** Infer colour category from free-text Use column. */
export function inferRequirementUseClass(
  useRaw: string | null | undefined,
): RequirementUseClass | null {
  if (!useRaw?.trim()) return null;
  const t = useRaw.trim().toLowerCase();

  if (/pending|negotiat/.test(t)) return 'pending';
  if (/sui\s*gen/.test(t)) return 'sui_generis';
  if (/investment/.test(t) && /develop/.test(t)) return 'investment';
  if (/investment/.test(t)) return 'investment';
  if (/develop/.test(t)) return 'development';
  if (/\bland\b/.test(t)) return 'land';
  if (
    /class\s*b|\bindustrial\b|\bwarehouse\b|\byard\b|hardstanding|container/.test(
      t,
    )
  ) {
    return 'class_b';
  }
  if (
    /class\s*e|\bretail\b|\boffice\b|\bcafe\b|\bcoffee\b|\bgym\b|\bnursery\b|\beducation\b|\bschool\b|\bclass\s*f\b/.test(
      t,
    )
  ) {
    return 'class_e';
  }
  // Ambiguous Class E / B → industrial lean when B mentioned
  if (/class\s*e\s*\/\s*b|class\s*e\s*&\s*b/.test(t)) return 'class_b';

  return null;
}

export function requirementUseClassStyle(
  useClass: string | null | undefined,
): { background: string; color: string } | null {
  const key = normalizeRequirementUseClass(useClass);
  if (!key) return null;
  return REQUIREMENT_USE_CLASS_STYLES[key];
}

/** Map stored tenure to Bracketts FH / LH labels. */
export function requirementTenureLabel(
  tenure: 'rent' | 'buy' | 'both' | null | undefined,
): string | null {
  if (tenure === 'buy') return 'FH';
  if (tenure === 'rent') return 'LH';
  if (tenure === 'both') return 'FH / LH';
  return null;
}

export function parseDetailsSent(raw: string | null | undefined): {
  sent: boolean;
  note: string | null;
} {
  const t = (raw ?? '').trim();
  if (!t) return { sent: false, note: null };
  if (/^(no|n|false|0)$/i.test(t)) return { sent: false, note: null };
  if (/^(yes|y|true|1|sent)$/i.test(t)) return { sent: true, note: null };
  return { sent: true, note: t };
}
