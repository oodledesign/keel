import {
  EPC_CERTIFICATE_NUMBER_RE,
  type EpcCertificateSummary,
  type EpcRecommendation,
  type EpcSearchHit,
  UK_POSTCODE_RE,
} from './types';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstString(
  record: Record<string, unknown> | null,
  keys: string[],
): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed && trimmed.toLowerCase() !== 'null') return trimmed;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

function firstNumber(
  record: Record<string, unknown> | null,
  keys: string[],
): number | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value.replace(/,/g, '').trim());
      if (Number.isFinite(parsed)) return parsed;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = firstNumber(value as Record<string, unknown>, [
        'value',
        'amount',
      ]);
      if (nested != null) return nested;
    }
  }
  return null;
}

export function normalizeUkPostcode(
  value: string | null | undefined,
): string | null {
  if (!value?.trim()) return null;
  const match = UK_POSTCODE_RE.exec(value.toUpperCase());
  if (!match?.[1]) return null;
  const compact = match[1].replace(/\s+/g, '');
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export function extractUkPostcode(
  value: string | null | undefined,
): string | null {
  return normalizeUkPostcode(value ?? null);
}

export function normalizeUprn(value: unknown): string | null {
  if (value == null) return null;
  const digits = String(value).replace(/\D/g, '');
  if (!digits || digits === '0') return null;
  return digits.replace(/^0+/, '') || null;
}

export function padUprn(value: string | null | undefined): string | null {
  const normalized = normalizeUprn(value);
  if (!normalized) return null;
  return normalized.padStart(12, '0');
}

export function normalizeCertificateNumber(
  value: string | null | undefined,
): string | null {
  if (!value?.trim()) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 20) return null;
  const formatted = [
    digits.slice(0, 4),
    digits.slice(4, 8),
    digits.slice(8, 12),
    digits.slice(12, 16),
    digits.slice(16, 20),
  ].join('-');
  return EPC_CERTIFICATE_NUMBER_RE.test(formatted) ? formatted : null;
}

export function bandFromScore(score: number | null): string | null {
  if (score == null || !Number.isFinite(score)) return null;
  if (score >= 92) return 'A';
  if (score >= 81) return 'B';
  if (score >= 69) return 'C';
  if (score >= 55) return 'D';
  if (score >= 39) return 'E';
  if (score >= 21) return 'F';
  if (score >= 1) return 'G';
  return null;
}

export function normalizeIsoDate(
  value: string | null | undefined,
): string | null {
  if (!value?.trim()) return null;
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

export function normalizeEnergyBand(
  value: string | null | undefined,
): string | null {
  const letter = value?.trim().toUpperCase().match(/[A-G]/)?.[0];
  return letter ?? null;
}

function unwrapData(payload: unknown): unknown {
  const record = asRecord(payload);
  if (!record) return payload;
  if ('data' in record) return record.data;
  return payload;
}

export function parseEpcSearchHits(payload: unknown): EpcSearchHit[] {
  const data = unwrapData(payload);
  const rows = Array.isArray(data) ? data : [];
  const hits: EpcSearchHit[] = [];

  for (const row of rows) {
    const record = asRecord(row);
    if (!record) continue;
    const certificateNumber = normalizeCertificateNumber(
      firstString(record, ['certificateNumber', 'certificate_number', 'rrn']),
    );
    if (!certificateNumber) continue;

    hits.push({
      certificateNumber,
      addressLine1: firstString(record, ['addressLine1', 'address_line_1']),
      addressLine2: firstString(record, ['addressLine2', 'address_line_2']),
      addressLine3: firstString(record, ['addressLine3', 'address_line_3']),
      addressLine4: firstString(record, ['addressLine4', 'address_line_4']),
      postTown: firstString(record, ['postTown', 'post_town']),
      postcode: normalizeUkPostcode(
        firstString(record, ['postcode', 'post_code']),
      ),
      uprn: normalizeUprn(record.uprn ?? record.UPRN),
      currentEnergyEfficiencyBand: normalizeEnergyBand(
        firstString(record, [
          'currentEnergyEfficiencyBand',
          'current_energy_efficiency_band',
          'current_energy_rating',
        ]),
      ),
      registrationDate: firstString(record, [
        'registrationDate',
        'registration_date',
        'lodgement_date',
        'lodgementDate',
      ]),
      schemaType: firstString(record, ['schemaType', 'schema_type']),
      council: firstString(record, ['council']),
    });
  }

  return hits;
}

function formatMoneyish(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `£${Math.round(value)}`;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  return null;
}

function recommendationDescription(record: Record<string, unknown>): string {
  const details = asRecord(record.improvement_details);
  const texts = asRecord(details?.improvement_texts);
  return (
    firstString(record, [
      'improvement_description',
      'description',
      'improvement',
    ]) ||
    firstString(texts, ['improvement_description', 'description']) ||
    firstString(record, ['improvement_type']) ||
    'Recommended improvement'
  );
}

export function parseEpcRecommendations(raw: unknown): EpcRecommendation[] {
  const record = asRecord(raw);
  const list =
    (Array.isArray(raw) ? raw : null) ??
    (Array.isArray(record?.suggested_improvements)
      ? record.suggested_improvements
      : null) ??
    (Array.isArray(record?.recommended_improvements)
      ? record.recommended_improvements
      : null) ??
    (Array.isArray(record?.recommendations) ? record.recommendations : null) ??
    [];

  const recommendations: EpcRecommendation[] = [];
  list.forEach((item, index) => {
    const row = asRecord(item);
    if (!row) return;
    recommendations.push({
      sequence:
        firstNumber(row, ['sequence', 'improvement_number']) ?? index + 1,
      description: recommendationDescription(row),
      typicalSaving: formatMoneyish(
        row.typical_saving ?? row.typicalSaving ?? row.saving,
      ),
      indicativeCost: formatMoneyish(
        row.indicative_cost ?? row.indicativeCost ?? row.cost,
      ),
    });
  });
  return recommendations;
}

export function summarizeRecommendations(
  recommendations: EpcRecommendation[],
): string | null {
  if (recommendations.length === 0) return null;
  return recommendations
    .slice(0, 8)
    .map((item) => {
      const extras = [item.indicativeCost, item.typicalSaving]
        .filter(Boolean)
        .join(', typical saving ');
      return extras ? `${item.description} (${extras})` : item.description;
    })
    .join('; ');
}

function fuelFromCertificate(record: Record<string, unknown>): string | null {
  const direct = firstString(record, [
    'main_fuel',
    'mainFuel',
    'main_heating_fuel',
    'fuel_type',
    'fuelType',
  ]);
  if (direct) return direct;

  const heating = record.main_heating;
  if (Array.isArray(heating)) {
    for (const item of heating) {
      const description = firstString(asRecord(item), ['description']);
      if (description) return description;
    }
  }

  const sap = asRecord(record.sap_heating);
  const details = Array.isArray(sap?.main_heating_details)
    ? sap.main_heating_details
    : [];
  for (const item of details) {
    const description = firstString(asRecord(item), [
      'description',
      'main_fuel_type',
    ]);
    if (description) return description;
  }

  return null;
}

export function parseEpcCertificate(
  payload: unknown,
  certificateNumber?: string | null,
): EpcCertificateSummary | null {
  const data = unwrapData(payload);
  const record = asRecord(data);
  if (!record) return null;

  const number =
    normalizeCertificateNumber(
      certificateNumber ??
        firstString(record, ['certificate_number', 'certificateNumber', 'rrn']),
    ) ?? null;

  const currentScore = firstNumber(record, [
    'energy_rating_current',
    'current_energy_efficiency',
    'currentEnergyEfficiency',
  ]);
  const potentialScore = firstNumber(record, [
    'energy_rating_potential',
    'potential_energy_efficiency',
    'potentialEnergyEfficiency',
  ]);
  const currentRating =
    normalizeEnergyBand(
      firstString(record, [
        'current_energy_efficiency_band',
        'currentEnergyEfficiencyBand',
        'current_energy_rating',
      ]),
    ) ?? bandFromScore(currentScore);
  const potentialRating =
    normalizeEnergyBand(
      firstString(record, [
        'potential_energy_efficiency_band',
        'potentialEnergyEfficiencyBand',
        'potential_energy_rating',
      ]),
    ) ?? bandFromScore(potentialScore);

  const recommendations = parseEpcRecommendations(record);

  return {
    certificateNumber: number ?? '',
    uprn: normalizeUprn(record.uprn ?? record.UPRN),
    addressLine1: firstString(record, ['address_line_1', 'addressLine1']),
    addressLine2: firstString(record, ['address_line_2', 'addressLine2']),
    postTown: firstString(record, ['post_town', 'postTown']),
    postcode: normalizeUkPostcode(firstString(record, ['postcode'])),
    currentRating,
    potentialRating,
    currentScore,
    potentialScore,
    lodgementDate: normalizeIsoDate(
      firstString(record, [
        'registration_date',
        'registrationDate',
        'lodgement_date',
        'lodgementDate',
        'inspection_date',
      ]),
    ),
    floorArea: firstNumber(record, [
      'total_floor_area',
      'totalFloorArea',
      'floor_area',
    ]),
    fuelType: fuelFromCertificate(record),
    dwellingType: firstString(record, [
      'dwelling_type',
      'dwellingType',
      'property_type',
    ]),
    recommendations,
    recommendationsSummary: summarizeRecommendations(recommendations),
  };
}

export function formatEpcAddress(input: {
  addressLine1?: string | null;
  addressLine2?: string | null;
  addressLine3?: string | null;
  addressLine4?: string | null;
  postTown?: string | null;
  postcode?: string | null;
}): string {
  return [
    input.addressLine1,
    input.addressLine2,
    input.addressLine3,
    input.addressLine4,
    input.postTown,
    input.postcode,
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ');
}
