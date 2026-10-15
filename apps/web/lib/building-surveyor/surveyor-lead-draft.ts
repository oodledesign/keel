/**
 * Form state for the building-surveyor lead form (strings, as typed) and its
 * mapping to the createDeal / updateDeal inputs.
 */
import type { AddressSuggestion } from '~/lib/commercial/address-suggest.types';

import {
  EMPTY_SURVEYOR_LEAD,
  type SurveyorLeadFields,
  type SurveyorLeadInput,
} from './surveyor-lead';

export type SurveyorLeadDraft = {
  stage: string;
  surveyType: string;
  assignedTo: string;
  inspectionDate: string;
  inspectionTime: string;
  leadInTime: string;
  addressLine1: string;
  addressLine2: string;
  town: string;
  county: string;
  postcode: string;
  latitude: string;
  longitude: string;
  propertyType: string;
  propertyAge: string;
  bedrooms: string;
  /** Pounds, as typed. */
  purchasePrice: string;
  tenure: string;
  accessContactName: string;
  accessContactPhone: string;
  contactName: string;
  source: string;
  contactPhone: string;
  contactEmail: string;
  clientAddress: string;
  /** Pounds plus VAT, as typed. */
  fee: string;
  comments: string;
  solicitorName: string;
  solicitorEmail: string;
  clientNotes: string;
};

export const EMPTY_SURVEYOR_LEAD_DRAFT: SurveyorLeadDraft = {
  stage: 'enquiry',
  surveyType: '',
  assignedTo: '',
  inspectionDate: '',
  inspectionTime: '',
  leadInTime: '',
  addressLine1: '',
  addressLine2: '',
  town: '',
  county: '',
  postcode: '',
  latitude: '',
  longitude: '',
  propertyType: '',
  propertyAge: '',
  bedrooms: '',
  purchasePrice: '',
  tenure: '',
  accessContactName: '',
  accessContactPhone: '',
  contactName: '',
  source: '',
  contactPhone: '',
  contactEmail: '',
  clientAddress: '',
  fee: '',
  comments: '',
  solicitorName: '',
  solicitorEmail: '',
  clientNotes: '',
};

export type SurveyorLeadDealSource = {
  stage: string;
  contactName: string;
  value: number;
  description: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  propertyType: string | null;
  surveyorLead?: SurveyorLeadFields;
};

function pad(value: number) {
  return String(value).padStart(2, '0');
}

/** Local date and time parts for an ISO timestamp. */
export function splitLocalDateTime(iso: string | null | undefined): {
  date: string;
  time: string;
} {
  if (!iso) return { date: '', time: '' };
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return { date: '', time: '' };
  return {
    date: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`,
    time: `${pad(at.getHours())}:${pad(at.getMinutes())}`,
  };
}

/** ISO timestamp from local date and time inputs (time defaults to 09:00). */
export function joinLocalDateTime(date: string, time: string): string | null {
  if (!date.trim()) return null;
  const at = new Date(`${date.trim()}T${time.trim() || '09:00'}`);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

function textOf(value: string | number | null | undefined) {
  return value === null || value === undefined ? '' : String(value);
}

export function leadDraftFromDeal(
  deal: SurveyorLeadDealSource,
): SurveyorLeadDraft {
  const lead = deal.surveyorLead ?? EMPTY_SURVEYOR_LEAD;
  const inspection = splitLocalDateTime(lead.inspectionAt);
  return {
    stage: deal.stage,
    surveyType: lead.surveyType ?? '',
    assignedTo: lead.assignedTo ?? '',
    inspectionDate: inspection.date,
    inspectionTime: inspection.time,
    leadInTime: lead.leadInTime ?? '',
    addressLine1: deal.addressLine1 ?? '',
    addressLine2: deal.addressLine2 ?? '',
    town: deal.town ?? '',
    county: deal.county ?? '',
    postcode: deal.postcode ?? '',
    latitude: textOf(deal.latitude),
    longitude: textOf(deal.longitude),
    propertyType: deal.propertyType ?? '',
    propertyAge: lead.propertyAge ?? '',
    bedrooms: textOf(lead.bedrooms),
    purchasePrice:
      lead.purchasePricePence === null
        ? ''
        : String(lead.purchasePricePence / 100),
    tenure: lead.tenure ?? '',
    accessContactName: lead.accessContactName ?? '',
    accessContactPhone: lead.accessContactPhone ?? '',
    contactName: deal.contactName ?? '',
    source: lead.source ?? '',
    contactPhone: lead.contactPhone ?? '',
    contactEmail: lead.contactEmail ?? '',
    clientAddress: lead.clientAddress ?? '',
    fee: deal.value ? String(deal.value) : '',
    comments: deal.description ?? '',
    solicitorName: lead.solicitorName ?? '',
    solicitorEmail: lead.solicitorEmail ?? '',
    clientNotes: lead.clientNotes ?? '',
  };
}

/** Applies an address search result to the property fields. */
export function applyAddressSuggestion(
  draft: SurveyorLeadDraft,
  suggestion: AddressSuggestion,
): SurveyorLeadDraft {
  return {
    ...draft,
    addressLine1: suggestion.addressLine1 ?? suggestion.label,
    addressLine2: suggestion.addressLine2 ?? '',
    town: suggestion.town ?? '',
    county: suggestion.county ?? '',
    postcode: suggestion.postcode ?? '',
    latitude: String(suggestion.latitude),
    longitude: String(suggestion.longitude),
  };
}

function numberFrom(value: string): number | null {
  const trimmed = value.replace(/[£,\s]/g, '');
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function coordinateFrom(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** One-line property address, as used on quotes and surveys. */
export function leadAddressLine(parts: {
  addressLine1?: string | null;
  addressLine2?: string | null;
  town?: string | null;
}): string {
  return [parts.addressLine1, parts.addressLine2, parts.town]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ');
}

export type SurveyorLeadSaveInput = {
  contactName: string;
  companyName: string;
  value: number;
  stage: string;
  description: string | null;
  property: {
    addressLine1: string | null;
    addressLine2: string | null;
    town: string | null;
    county: string | null;
    postcode: string | null;
    latitude: number | null;
    longitude: number | null;
    propertyType: string | null;
  };
  lead: SurveyorLeadInput;
};

export function leadDraftToSaveInput(
  draft: SurveyorLeadDraft,
): SurveyorLeadSaveInput {
  const purchasePounds = numberFrom(draft.purchasePrice);
  const bedrooms = numberFrom(draft.bedrooms);
  const address = leadAddressLine(draft);
  return {
    contactName: draft.contactName.trim(),
    companyName: address,
    value: Math.round(numberFrom(draft.fee) ?? 0),
    stage: draft.stage,
    description: draft.comments.trim() || null,
    property: {
      addressLine1: draft.addressLine1.trim() || null,
      addressLine2: draft.addressLine2.trim() || null,
      town: draft.town.trim() || null,
      county: draft.county.trim() || null,
      postcode: draft.postcode.trim() || null,
      latitude: coordinateFrom(draft.latitude),
      longitude: coordinateFrom(draft.longitude),
      propertyType: draft.propertyType.trim() || null,
    },
    lead: {
      surveyType: draft.surveyType || null,
      assignedTo: draft.assignedTo || null,
      inspectionAt: joinLocalDateTime(
        draft.inspectionDate,
        draft.inspectionTime,
      ),
      leadInTime: draft.leadInTime,
      propertyAge: draft.propertyAge,
      bedrooms: bedrooms === null ? null : Math.round(bedrooms),
      purchasePricePence:
        purchasePounds === null ? null : Math.round(purchasePounds * 100),
      tenure: draft.tenure,
      accessContactName: draft.accessContactName,
      accessContactPhone: draft.accessContactPhone,
      clientAddress: draft.clientAddress,
      solicitorName: draft.solicitorName,
      solicitorEmail: draft.solicitorEmail,
      clientNotes: draft.clientNotes,
      contactEmail: draft.contactEmail,
      contactPhone: draft.contactPhone,
      source: draft.source,
    },
  };
}
