import { z } from 'zod';

import {
  type CoverFocus,
  SURVEY_COVER_SELECT,
  mapSurveyCoverPhotoDocId,
  parseCoverFocus,
} from './survey-cover';
import {
  SURVEY_DRONE_SELECT,
  type SurveyDrone,
  mapSurveyDrone,
} from './survey-drone';

export const ACCOMMODATION_FLOORS = [
  { key: 'lower_ground', label: 'Lower ground' },
  { key: 'ground', label: 'Ground' },
  { key: 'first', label: 'First' },
  { key: 'second', label: 'Second' },
  { key: 'third', label: 'Third' },
  { key: 'other', label: 'Other' },
  { key: 'roof_space', label: 'Roof space' },
] as const;

export const ACCOMMODATION_ROOMS = [
  { key: 'living', label: 'Living rooms' },
  { key: 'bedrooms', label: 'Bedrooms' },
  { key: 'bath_shower', label: 'Bath or shower' },
  { key: 'separate_wc', label: 'Separate toilet' },
  { key: 'kitchen', label: 'Kitchen' },
  { key: 'utility', label: 'Utility room' },
  { key: 'conservatory', label: 'Conservatory' },
  { key: 'other', label: 'Other' },
] as const;

export type AccommodationFloorKey =
  (typeof ACCOMMODATION_FLOORS)[number]['key'];
export type AccommodationRoomKey = (typeof ACCOMMODATION_ROOMS)[number]['key'];

export type SurveyAccommodation = Partial<
  Record<AccommodationFloorKey, Partial<Record<AccommodationRoomKey, number>>>
>;

const roomCount = z.number().int().min(0).max(99);

export const SurveyAccommodationSchema = z.object(
  Object.fromEntries(
    ACCOMMODATION_FLOORS.map((floor) => [
      floor.key,
      z
        .object(
          Object.fromEntries(
            ACCOMMODATION_ROOMS.map((room) => [room.key, roomCount.optional()]),
          ),
        )
        .optional(),
    ]),
  ),
) as unknown as z.ZodType<SurveyAccommodation>;

export function parseSurveyAccommodation(value: unknown): SurveyAccommodation {
  const parsed = SurveyAccommodationSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

export function accommodationHasCounts(value: SurveyAccommodation): boolean {
  return Object.values(value).some((row) =>
    Object.values(row ?? {}).some((count) => (count ?? 0) > 0),
  );
}

export const MAIN_SERVICES = [
  { key: 'gas', label: 'Gas' },
  { key: 'electric', label: 'Electric' },
  { key: 'water', label: 'Water' },
  { key: 'drainage', label: 'Drainage' },
] as const;

export const CENTRAL_HEATING = [
  { key: 'gas', label: 'Gas' },
  { key: 'electric', label: 'Electric' },
  { key: 'solid_fuel', label: 'Solid fuel' },
  { key: 'oil', label: 'Oil' },
  { key: 'none', label: 'None' },
] as const;

export type SurveyServices = {
  main: string[];
  heating: string[];
};

export const SurveyServicesSchema = z.object({
  main: z.array(z.enum(['gas', 'electric', 'water', 'drainage'])).max(8),
  heating: z
    .array(z.enum(['gas', 'electric', 'solid_fuel', 'oil', 'none']))
    .max(8),
});

export function parseSurveyServices(value: unknown): SurveyServices | null {
  const parsed = SurveyServicesSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export const SurveyorQualificationSchema = z.object({
  year: z.string().trim().max(10),
  establishment: z.string().trim().max(200),
  qualification: z.string().trim().max(200),
});

export type SurveyorQualification = z.infer<typeof SurveyorQualificationSchema>;

export const SurveyorProfileFieldsSchema = z.object({
  displayName: z.string().trim().max(160).nullable(),
  ricsNumber: z.string().trim().max(40).nullable(),
  phone: z.string().trim().max(40).nullable(),
  email: z.string().trim().max(200).nullable(),
  website: z.string().trim().max(300).nullable(),
  address: z.string().trim().max(500).nullable(),
  qualifications: z.array(SurveyorQualificationSchema).max(12),
});

export type SurveyorProfile = z.infer<typeof SurveyorProfileFieldsSchema>;

export const EMPTY_SURVEYOR_PROFILE: SurveyorProfile = {
  displayName: null,
  ricsNumber: null,
  phone: null,
  email: null,
  website: null,
  address: null,
  qualifications: [],
};

export function mapSurveyorProfileRow(
  row: Record<string, unknown> | null | undefined,
): SurveyorProfile {
  if (!row) return EMPTY_SURVEYOR_PROFILE;
  const text = (key: string) => {
    const value = row[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  };
  const qualifications = z
    .array(SurveyorQualificationSchema)
    .safeParse(row.qualifications);
  return {
    displayName: text('display_name'),
    ricsNumber: text('rics_number'),
    phone: text('phone'),
    email: text('email'),
    website: text('website'),
    address: text('address'),
    qualifications: qualifications.success ? qualifications.data : [],
  };
}

/** Formats an ISO date (YYYY-MM-DD) as "5 August 2026" for the report. */
export function formatReportDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export type SurveyReportDetails = {
  inspectionDate: string | null;
  termsReceivedDate: string | null;
  reportReference: string | null;
  accommodation: SurveyAccommodation;
  services: SurveyServices | null;
  drone: SurveyDrone;
  coverPhotoDocId: string | null;
  coverFocus: CoverFocus;
};

export const SURVEY_REPORT_DETAILS_SELECT = `survey_inspection_date, survey_terms_received_date, survey_report_reference, survey_accommodation, survey_services, ${SURVEY_DRONE_SELECT}, ${SURVEY_COVER_SELECT}`;

export const SURVEYOR_PROFILE_SELECT =
  'display_name, rics_number, phone, email, website, address, qualifications';

export function mapSurveyReportDetails(
  row: Record<string, unknown>,
): SurveyReportDetails {
  const text = (key: string) =>
    typeof row[key] === 'string' && (row[key] as string).trim()
      ? (row[key] as string).trim()
      : null;
  return {
    inspectionDate: text('survey_inspection_date'),
    termsReceivedDate: text('survey_terms_received_date'),
    reportReference: text('survey_report_reference'),
    accommodation: parseSurveyAccommodation(row.survey_accommodation),
    services: parseSurveyServices(row.survey_services),
    drone: mapSurveyDrone(row),
    coverPhotoDocId: mapSurveyCoverPhotoDocId(row),
    coverFocus: parseCoverFocus(row.survey_cover_focus),
  };
}
