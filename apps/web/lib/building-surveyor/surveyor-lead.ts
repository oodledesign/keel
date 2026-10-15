/**
 * Building-surveyor lead: the instruction sheet fields, stage ticks, traffic
 * lights and archive selection. Stored on pipeline_deals.
 */
import {
  type BuildingSurveyorPipelineStage,
  SURVEYOR_ARCHIVABLE_STAGES,
} from './pipeline-stages';

export const SURVEYOR_LEAD_SURVEY_TYPES = [
  { key: 'rics_hss_l2', label: 'Level 2' },
  { key: 'rics_hss_l3', label: 'Level 3' },
  { key: 'commercial_condition', label: 'Commercial' },
] as const;

export type SurveyorLeadSurveyType =
  (typeof SURVEYOR_LEAD_SURVEY_TYPES)[number]['key'];

export function surveyorLeadSurveyTypeLabel(
  value: string | null | undefined,
): string | null {
  return (
    SURVEYOR_LEAD_SURVEY_TYPES.find((option) => option.key === value)?.label ??
    null
  );
}

/** Survey level for a lead instruction type, when it is a home survey. */
export function surveyLevelForLeadType(
  surveyType: string | null | undefined,
): 2 | 3 | null {
  if (surveyType === 'rics_hss_l2') return 2;
  if (surveyType === 'rics_hss_l3') return 3;
  return null;
}

export const SURVEYOR_LEAD_SOURCES = [
  'Solicitor',
  'Agent',
  'Internet',
  'Existing client',
  'Other',
] as const;

export const SURVEYOR_LEAD_TENURES = [
  'Freehold',
  'Leasehold',
  'Share of freehold',
] as const;

export type SurveyorLeadTicks = {
  quoteSentByPhone: boolean;
  quoteSentByEmail: boolean;
  tobSigned: boolean;
  tobSignedAt: string | null;
  reportChecked: boolean;
  reportCheckedBy: string | null;
  reportCheckedAt: string | null;
};

export type SurveyorLeadFields = SurveyorLeadTicks & {
  assignedTo: string | null;
  surveyType: string | null;
  inspectionAt: string | null;
  leadInTime: string | null;
  propertyAge: string | null;
  bedrooms: number | null;
  purchasePricePence: number | null;
  tenure: string | null;
  accessContactName: string | null;
  accessContactPhone: string | null;
  clientAddress: string | null;
  solicitorName: string | null;
  solicitorEmail: string | null;
  clientNotes: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  source: string | null;
  lastActivityAt: string | null;
  lostAt: string | null;
};

export const EMPTY_SURVEYOR_LEAD: SurveyorLeadFields = {
  quoteSentByPhone: false,
  quoteSentByEmail: false,
  tobSigned: false,
  tobSignedAt: null,
  reportChecked: false,
  reportCheckedBy: null,
  reportCheckedAt: null,
  assignedTo: null,
  surveyType: null,
  inspectionAt: null,
  leadInTime: null,
  propertyAge: null,
  bedrooms: null,
  purchasePricePence: null,
  tenure: null,
  accessContactName: null,
  accessContactPhone: null,
  clientAddress: null,
  solicitorName: null,
  solicitorEmail: null,
  clientNotes: null,
  contactEmail: null,
  contactPhone: null,
  source: null,
  lastActivityAt: null,
  lostAt: null,
};

/** Columns read for a surveyor lead, on top of the shared pipeline deal. */
export const SURVEYOR_LEAD_SELECT =
  'id, assigned_to, survey_type, inspection_at, lead_in_time, property_age, bedrooms, purchase_price_pence, tenure, access_contact_name, access_contact_phone, client_address, solicitor_name, solicitor_email, client_notes, contact_email, contact_phone, source, quote_sent_by_phone, quote_sent_by_email, tob_signed, tob_signed_at, report_checked, report_checked_by, report_checked_at, last_activity_at, lost_at';

export type SurveyorLeadRow = {
  id: string;
  assigned_to?: string | null;
  survey_type?: string | null;
  inspection_at?: string | null;
  lead_in_time?: string | null;
  property_age?: string | null;
  bedrooms?: number | null;
  purchase_price_pence?: number | string | null;
  tenure?: string | null;
  access_contact_name?: string | null;
  access_contact_phone?: string | null;
  client_address?: string | null;
  solicitor_name?: string | null;
  solicitor_email?: string | null;
  client_notes?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  source?: string | null;
  quote_sent_by_phone?: boolean | null;
  quote_sent_by_email?: boolean | null;
  tob_signed?: boolean | null;
  tob_signed_at?: string | null;
  report_checked?: boolean | null;
  report_checked_by?: string | null;
  report_checked_at?: string | null;
  last_activity_at?: string | null;
  lost_at?: string | null;
};

function numberOrNull(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function mapSurveyorLeadRow(row: SurveyorLeadRow): SurveyorLeadFields {
  return {
    assignedTo: row.assigned_to ?? null,
    surveyType: row.survey_type ?? null,
    inspectionAt: row.inspection_at ?? null,
    leadInTime: row.lead_in_time ?? null,
    propertyAge: row.property_age ?? null,
    bedrooms: numberOrNull(row.bedrooms),
    purchasePricePence: numberOrNull(row.purchase_price_pence),
    tenure: row.tenure ?? null,
    accessContactName: row.access_contact_name ?? null,
    accessContactPhone: row.access_contact_phone ?? null,
    clientAddress: row.client_address ?? null,
    solicitorName: row.solicitor_name ?? null,
    solicitorEmail: row.solicitor_email ?? null,
    clientNotes: row.client_notes ?? null,
    contactEmail: row.contact_email ?? null,
    contactPhone: row.contact_phone ?? null,
    source: row.source ?? null,
    quoteSentByPhone: Boolean(row.quote_sent_by_phone),
    quoteSentByEmail: Boolean(row.quote_sent_by_email),
    tobSigned: Boolean(row.tob_signed),
    tobSignedAt: row.tob_signed_at ?? null,
    reportChecked: Boolean(row.report_checked),
    reportCheckedBy: row.report_checked_by ?? null,
    reportCheckedAt: row.report_checked_at ?? null,
    lastActivityAt: row.last_activity_at ?? null,
    lostAt: row.lost_at ?? null,
  };
}

/** Editable instruction sheet fields. Only keys that are sent are written. */
export type SurveyorLeadInput = Partial<{
  assignedTo: string | null;
  surveyType: string | null;
  inspectionAt: string | null;
  leadInTime: string | null;
  propertyAge: string | null;
  bedrooms: number | null;
  purchasePricePence: number | null;
  tenure: string | null;
  accessContactName: string | null;
  accessContactPhone: string | null;
  clientAddress: string | null;
  solicitorName: string | null;
  solicitorEmail: string | null;
  clientNotes: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  source: string | null;
}>;

const LEAD_TEXT_COLUMNS = {
  assignedTo: 'assigned_to',
  surveyType: 'survey_type',
  inspectionAt: 'inspection_at',
  leadInTime: 'lead_in_time',
  propertyAge: 'property_age',
  tenure: 'tenure',
  accessContactName: 'access_contact_name',
  accessContactPhone: 'access_contact_phone',
  clientAddress: 'client_address',
  solicitorName: 'solicitor_name',
  solicitorEmail: 'solicitor_email',
  clientNotes: 'client_notes',
  contactEmail: 'contact_email',
  contactPhone: 'contact_phone',
  source: 'source',
} as const satisfies Partial<Record<keyof SurveyorLeadInput, string>>;

export function surveyorLeadInputToColumns(
  input: SurveyorLeadInput | undefined,
): Record<string, string | number | null> {
  if (!input) return {};
  const out: Record<string, string | number | null> = {};
  for (const [key, column] of Object.entries(LEAD_TEXT_COLUMNS)) {
    const value = input[key as keyof typeof LEAD_TEXT_COLUMNS];
    if (value === undefined) continue;
    out[column] = typeof value === 'string' ? value.trim() || null : null;
  }
  if (input.bedrooms !== undefined) {
    out.bedrooms =
      input.bedrooms === null ? null : Math.max(0, Math.round(input.bedrooms));
  }
  if (input.purchasePricePence !== undefined) {
    out.purchase_price_pence =
      input.purchasePricePence === null
        ? null
        : Math.max(0, Math.round(input.purchasePricePence));
  }
  return out;
}

// ─── Ticks ───────────────────────────────────────────────────────────

export type SurveyorTickKey =
  | 'quoteSentByPhone'
  | 'quoteSentByEmail'
  | 'tobSigned'
  | 'reportChecked';

export const SURVEYOR_TICK_LABELS: Record<SurveyorTickKey, string> = {
  quoteSentByPhone: 'Quote sent by phone',
  quoteSentByEmail: 'Quote sent by email',
  tobSigned: 'Terms of business signed',
  reportChecked: 'Report checked',
};

/** Ticks shown on a card or form for the lead's current stage. */
export const SURVEYOR_STAGE_TICKS: Partial<
  Record<BuildingSurveyorPipelineStage, SurveyorTickKey[]>
> = {
  quoted: ['quoteSentByPhone', 'quoteSentByEmail'],
  tob_sent: ['tobSigned'],
  reported: ['reportChecked'],
};

export type SurveyorTickInput = Partial<{
  quoteSentByPhone: boolean;
  quoteSentByEmail: boolean;
  tobSigned: boolean;
  reportChecked: boolean;
  reportCheckedBy: string | null;
}>;

export type SurveyorTickChange = {
  tick: SurveyorTickKey | 'reportCheckedBy';
  value: boolean | string | null;
};

/**
 * Columns and events for a tick update. Audit columns are stamped when a tick
 * turns on and cleared when it turns off. Unchanged ticks produce nothing.
 */
export function resolveSurveyorTickUpdate(input: {
  current: SurveyorLeadTicks;
  next: SurveyorTickInput | undefined;
  userId: string;
  now: string;
}): {
  columns: Record<string, boolean | string | null>;
  changes: SurveyorTickChange[];
} {
  const { current, next, userId, now } = input;
  const columns: Record<string, boolean | string | null> = {};
  const changes: SurveyorTickChange[] = [];
  if (!next) return { columns, changes };

  if (
    next.quoteSentByPhone !== undefined &&
    next.quoteSentByPhone !== current.quoteSentByPhone
  ) {
    columns.quote_sent_by_phone = next.quoteSentByPhone;
    changes.push({ tick: 'quoteSentByPhone', value: next.quoteSentByPhone });
  }
  if (
    next.quoteSentByEmail !== undefined &&
    next.quoteSentByEmail !== current.quoteSentByEmail
  ) {
    columns.quote_sent_by_email = next.quoteSentByEmail;
    changes.push({ tick: 'quoteSentByEmail', value: next.quoteSentByEmail });
  }
  if (next.tobSigned !== undefined && next.tobSigned !== current.tobSigned) {
    columns.tob_signed = next.tobSigned;
    columns.tob_signed_at = next.tobSigned ? now : null;
    changes.push({ tick: 'tobSigned', value: next.tobSigned });
  }

  let checked = current.reportChecked;
  if (
    next.reportChecked !== undefined &&
    next.reportChecked !== current.reportChecked
  ) {
    checked = next.reportChecked;
    columns.report_checked = checked;
    columns.report_checked_at = checked ? now : null;
    if (!checked) columns.report_checked_by = null;
    changes.push({ tick: 'reportChecked', value: checked });
  }
  if (checked) {
    const checkedBy =
      next.reportCheckedBy !== undefined
        ? next.reportCheckedBy
        : columns.report_checked !== undefined
          ? current.reportCheckedBy || userId
          : undefined;
    if (checkedBy !== undefined && checkedBy !== current.reportCheckedBy) {
      columns.report_checked_by = checkedBy;
      changes.push({ tick: 'reportCheckedBy', value: checkedBy });
    }
  }

  return { columns, changes };
}

/** Optimistic local copy of a tick update (the server stamps the audit times). */
export function applySurveyorTickInput<T extends SurveyorLeadTicks>(
  lead: T,
  input: SurveyorTickInput,
  now: string = new Date().toISOString(),
): T {
  const next = { ...lead };
  if (input.quoteSentByPhone !== undefined) {
    next.quoteSentByPhone = input.quoteSentByPhone;
  }
  if (input.quoteSentByEmail !== undefined) {
    next.quoteSentByEmail = input.quoteSentByEmail;
  }
  if (input.tobSigned !== undefined) {
    next.tobSigned = input.tobSigned;
    next.tobSignedAt = input.tobSigned ? now : null;
  }
  if (input.reportChecked !== undefined) {
    next.reportChecked = input.reportChecked;
    next.reportCheckedAt = input.reportChecked ? now : null;
    if (!input.reportChecked) next.reportCheckedBy = null;
  }
  if (input.reportCheckedBy !== undefined && next.reportChecked) {
    next.reportCheckedBy = input.reportCheckedBy;
  }
  return next;
}

// ─── Activity: traffic lights and archive ────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

export type SurveyorPipelineSettings = {
  leadAmberDays: number;
  leadRedDays: number;
  leadArchiveDays: number;
  quoteReminderDays: number;
  quoteReminderClientEmail: boolean;
};

export const DEFAULT_SURVEYOR_PIPELINE_SETTINGS: SurveyorPipelineSettings = {
  leadAmberDays: 7,
  leadRedDays: 14,
  leadArchiveDays: 30,
  quoteReminderDays: 3,
  quoteReminderClientEmail: false,
};

function positiveDays(value: unknown, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.round(parsed) : fallback;
}

export function normalizeSurveyorPipelineSettings(
  row:
    | {
        lead_amber_days?: unknown;
        lead_red_days?: unknown;
        lead_archive_days?: unknown;
        quote_reminder_days?: unknown;
        quote_reminder_client_email?: unknown;
      }
    | null
    | undefined,
): SurveyorPipelineSettings {
  const defaults = DEFAULT_SURVEYOR_PIPELINE_SETTINGS;
  const amber = positiveDays(row?.lead_amber_days, defaults.leadAmberDays);
  const red = Math.max(
    amber,
    positiveDays(row?.lead_red_days, defaults.leadRedDays),
  );
  return {
    leadAmberDays: amber,
    leadRedDays: red,
    leadArchiveDays: positiveDays(
      row?.lead_archive_days,
      defaults.leadArchiveDays,
    ),
    quoteReminderDays: positiveDays(
      row?.quote_reminder_days,
      defaults.quoteReminderDays,
    ),
    quoteReminderClientEmail: row?.quote_reminder_client_email === true,
  };
}

/** Whole days since the last activity (0 when unknown or in the future). */
export function idleDays(
  lastActivityAt: string | null | undefined,
  now: Date = new Date(),
): number {
  if (!lastActivityAt) return 0;
  const at = new Date(lastActivityAt).getTime();
  if (Number.isNaN(at)) return 0;
  return Math.max(0, Math.floor((now.getTime() - at) / DAY_MS));
}

export type LeadTrafficLight = 'green' | 'amber' | 'red';

export function leadTrafficLight(
  lastActivityAt: string | null | undefined,
  thresholds: Pick<SurveyorPipelineSettings, 'leadAmberDays' | 'leadRedDays'>,
  now: Date = new Date(),
): LeadTrafficLight | null {
  if (!lastActivityAt) return null;
  const days = idleDays(lastActivityAt, now);
  if (days >= thresholds.leadRedDays) return 'red';
  if (days >= thresholds.leadAmberDays) return 'amber';
  return 'green';
}

export const LEAD_TRAFFIC_LIGHT_LABELS: Record<LeadTrafficLight, string> = {
  green: 'Recent activity',
  amber: 'Going quiet',
  red: 'No recent activity',
};

/** Inquiry and Quote sent leads idle for at least `archiveDays`, oldest first. */
export function selectLeadsToArchive<
  T extends { id: string; stage: string; lastActivityAt: string | null },
>(leads: T[], archiveDays: number, now: Date = new Date()): T[] {
  const stages = SURVEYOR_ARCHIVABLE_STAGES as readonly string[];
  return leads
    .filter(
      (lead) =>
        stages.includes(lead.stage) &&
        lead.lastActivityAt !== null &&
        idleDays(lead.lastActivityAt, now) >= archiveDays,
    )
    .sort(
      (a, b) =>
        new Date(a.lastActivityAt ?? 0).getTime() -
        new Date(b.lastActivityAt ?? 0).getTime(),
    );
}
