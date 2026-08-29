import { COMMERCIAL_PROPERTY_TYPES } from '~/lib/commercial/commercial-constants';
import { REQUIREMENT_LOCATION_RADIUS_OPTIONS as RADIUS_OPTIONS } from '~/lib/commercial/requirement-form-fields';
import {
  REQUIREMENT_USE_CLASSES,
  REQUIREMENT_USE_CLASS_LABELS,
  type RequirementUseClass,
  inferRequirementUseClass,
  normalizeRequirementUseClass,
} from '~/lib/commercial/requirement-use-class';

import {
  type FormContactValues,
  type WorkspaceFormField,
  defaultWorkspaceFormFields,
  listingHiddenField,
} from './form-fields';

export const MAILING_LIST_OPT_IN_KEY = 'marketing_opt_in';

export const MAILING_LIST_SPEC_KEYS = [
  'company_name',
  'sector',
  'tenure',
  'location_text',
  'search_radius_miles',
  'size_min_sqft',
  'size_max_sqft',
  'use_class',
  'budget_min',
  'budget_max',
  MAILING_LIST_OPT_IN_KEY,
] as const;

export type MailingListSpec = {
  companyName: string | null;
  sector: string | null;
  tenure: 'rent' | 'buy' | 'both' | null;
  locationText: string | null;
  searchRadiusMiles: number | null;
  sizeMinSqft: number | null;
  sizeMaxSqft: number | null;
  useClass: RequirementUseClass | null;
  budgetMinPence: number | null;
  budgetMaxPence: number | null;
  notes: string | null;
  marketingOptIn: boolean;
};

const TENURE_OPTIONS = ['To let', 'For sale', 'Both'] as const;

function field(partial: WorkspaceFormField): WorkspaceFormField {
  return partial;
}

export function mailingListCompanyField(): WorkspaceFormField {
  return field({
    id: 'company_name',
    type: 'text',
    key: 'company_name',
    label: 'Company',
    required: false,
    placeholder: 'Optional',
  });
}

export function mailingListOptInField(commercial: boolean): WorkspaceFormField {
  return field({
    id: MAILING_LIST_OPT_IN_KEY,
    type: 'checkbox',
    key: MAILING_LIST_OPT_IN_KEY,
    label: commercial
      ? 'Email me matching properties and workspace updates. I can unsubscribe at any time.'
      : 'Email me updates from this workspace. I can unsubscribe at any time.',
    required: true,
  });
}

function commercialSpecFields(): WorkspaceFormField[] {
  return [
    field({
      id: 'sector',
      type: 'select',
      key: 'sector',
      label: 'Property type',
      required: false,
      options: [...COMMERCIAL_PROPERTY_TYPES],
    }),
    field({
      id: 'tenure',
      type: 'select',
      key: 'tenure',
      label: 'Looking to',
      required: false,
      options: [...TENURE_OPTIONS],
    }),
    field({
      id: 'location_text',
      type: 'text',
      key: 'location_text',
      label: 'Location',
      required: false,
      placeholder: 'Town, postcode, or area',
    }),
    field({
      id: 'search_radius_miles',
      type: 'select',
      key: 'search_radius_miles',
      label: 'Search radius',
      required: false,
      options: RADIUS_OPTIONS.map((option) => option.label),
    }),
    field({
      id: 'size_min_sqft',
      type: 'text',
      key: 'size_min_sqft',
      label: 'Min size (sq ft)',
      required: false,
      placeholder: 'e.g. 1500',
    }),
    field({
      id: 'size_max_sqft',
      type: 'text',
      key: 'size_max_sqft',
      label: 'Max size (sq ft)',
      required: false,
      placeholder: 'e.g. 5000',
    }),
    field({
      id: 'use_class',
      type: 'select',
      key: 'use_class',
      label: 'Use class',
      required: false,
      options: REQUIREMENT_USE_CLASSES.map(
        (key) => REQUIREMENT_USE_CLASS_LABELS[key],
      ),
    }),
    field({
      id: 'budget_min',
      type: 'text',
      key: 'budget_min',
      label: 'Min budget (£)',
      required: false,
      placeholder: 'Optional',
    }),
    field({
      id: 'budget_max',
      type: 'text',
      key: 'budget_max',
      label: 'Max budget (£)',
      required: false,
      placeholder: 'Optional',
    }),
    listingHiddenField(),
  ];
}

export function defaultMailingListFormFields(options: {
  commercial: boolean;
}): WorkspaceFormField[] {
  const base = defaultWorkspaceFormFields().map((item) =>
    item.key === 'message'
      ? {
          ...item,
          label: 'Notes',
          placeholder: options.commercial
            ? 'Anything else about your requirement?'
            : 'Anything we should know?',
        }
      : item,
  );

  const withCompany = [
    ...base.slice(0, 3),
    mailingListCompanyField(),
    ...base.slice(3),
  ];

  if (!options.commercial) {
    return [...withCompany, mailingListOptInField(false)];
  }

  return [
    ...withCompany,
    ...commercialSpecFields(),
    mailingListOptInField(true),
  ];
}

export function ensureMailingListFields(
  fields: WorkspaceFormField[],
  options: { commercial: boolean },
): WorkspaceFormField[] {
  const defaults = defaultMailingListFormFields(options);
  const keys = new Set(fields.map((item) => item.key));
  const missing = defaults.filter((item) => !keys.has(item.key));
  return missing.length ? [...fields, ...missing] : fields;
}

export function parseTenureOption(
  value: string | boolean | undefined,
): 'rent' | 'buy' | 'both' | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (
    normalized === 'rent' ||
    normalized === 'to let' ||
    normalized === 'to_let'
  ) {
    return 'rent';
  }
  if (
    normalized === 'buy' ||
    normalized === 'for sale' ||
    normalized === 'for_sale'
  ) {
    return 'buy';
  }
  if (
    normalized === 'both' ||
    (normalized.includes('to let') && normalized.includes('for sale'))
  ) {
    return 'both';
  }
  return null;
}

export function parseRadiusMiles(
  value: string | boolean | undefined,
): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;

  const match = RADIUS_OPTIONS.find(
    (option) => option.label.toLowerCase() === value.trim().toLowerCase(),
  );
  if (match) return match.miles;

  const numeric = Number(value.replace(/[^\d.]/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

export function parsePoundsToPence(
  value: string | boolean | undefined,
): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value * 100);
  }
  if (typeof value !== 'string' || !value.trim()) return null;
  const numeric = Number(value.replace(/[£,\s]/g, ''));
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.round(numeric * 100);
}

export function parseSqft(value: string | boolean | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value !== 'string' || !value.trim()) return null;
  const numeric = Number(value.replace(/[,\s]/g, ''));
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

export function parseUseClassOption(
  value: string | boolean | undefined,
): RequirementUseClass | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const trimmed = value.trim();
  const fromLabel = REQUIREMENT_USE_CLASSES.find(
    (key) => REQUIREMENT_USE_CLASS_LABELS[key] === trimmed,
  );
  if (fromLabel) return fromLabel;
  return (
    normalizeRequirementUseClass(trimmed) ?? inferRequirementUseClass(trimmed)
  );
}

function extraString(
  extras: Record<string, string | boolean>,
  key: string,
): string | boolean | undefined {
  return extras[key];
}

export function isMailingListOptedIn(contact: FormContactValues): boolean {
  const raw = contact.extras[MAILING_LIST_OPT_IN_KEY];
  return raw === true || raw === 'true' || raw === 'on' || raw === '1';
}

export function extractMailingListSpec(
  contact: FormContactValues,
): MailingListSpec {
  const extras = contact.extras;
  const sectorRaw = extraString(extras, 'sector');
  const sector =
    typeof sectorRaw === 'string' && sectorRaw.trim() ? sectorRaw.trim() : null;

  return {
    companyName: contact.companyName,
    sector,
    tenure: parseTenureOption(extraString(extras, 'tenure')),
    locationText:
      typeof extras.location_text === 'string' && extras.location_text.trim()
        ? extras.location_text.trim()
        : null,
    searchRadiusMiles: parseRadiusMiles(
      extraString(extras, 'search_radius_miles'),
    ),
    sizeMinSqft: parseSqft(extraString(extras, 'size_min_sqft')),
    sizeMaxSqft: parseSqft(extraString(extras, 'size_max_sqft')),
    useClass:
      parseUseClassOption(extraString(extras, 'use_class')) ??
      inferRequirementUseClass(sector),
    budgetMinPence: parsePoundsToPence(extraString(extras, 'budget_min')),
    budgetMaxPence: parsePoundsToPence(extraString(extras, 'budget_max')),
    notes: contact.message,
    marketingOptIn: isMailingListOptedIn(contact),
  };
}

export { RADIUS_OPTIONS, TENURE_OPTIONS };
