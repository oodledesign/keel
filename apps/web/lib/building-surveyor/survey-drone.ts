import { z } from 'zod';

/** Used until a workspace sets its own drone fee (15000 pence = 150.00). */
export const DEFAULT_DRONE_FEE_PENCE = 15_000;

/** Upper bound for a typed fee: 100,000.00 in minor units. */
export const MAX_DRONE_FEE_PENCE = 10_000_000;

export const DRONE_BILLING_OPTIONS = ['separate', 'included'] as const;

export type DroneBilling = (typeof DRONE_BILLING_OPTIONS)[number];

export const DroneBillingSchema = z.enum(DRONE_BILLING_OPTIONS);

export const DroneFeePenceSchema = z
  .number()
  .int()
  .min(0)
  .max(MAX_DRONE_FEE_PENCE);

export type SurveyDrone = {
  used: boolean;
  billing: DroneBilling;
  /** NULL means "use the workspace default fee". */
  feePence: number | null;
};

export const EMPTY_SURVEY_DRONE: SurveyDrone = {
  used: false,
  billing: 'separate',
  feePence: null,
};

export function mapSurveyDrone(row: Record<string, unknown>): SurveyDrone {
  const fee = row.survey_drone_fee_pence;
  return {
    used: row.survey_drone_used === true,
    billing: row.survey_drone_billing === 'included' ? 'included' : 'separate',
    feePence:
      typeof fee === 'number' && Number.isInteger(fee) && fee >= 0 ? fee : null,
  };
}

export const SURVEY_DRONE_SELECT =
  'survey_drone_used, survey_drone_billing, survey_drone_fee_pence';

/** The fee that applies: the typed one, else the workspace default. */
export function effectiveDroneFeePence(
  drone: Pick<SurveyDrone, 'feePence'>,
  defaultFeePence: number,
): number {
  return drone.feePence ?? defaultFeePence;
}

/** "£150" for whole amounts, "£150.50" otherwise. */
export function formatDroneFee(
  pence: number,
  currency: string = 'gbp',
): string {
  const whole = pence % 100 === 0;
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(pence / 100);
  } catch {
    return `${(pence / 100).toFixed(whole ? 0 : 2)}`;
  }
}

/** Pence from a typed amount such as "150" or "150.50"; null when invalid. */
export function penceFromInput(value: string): number | null {
  const cleaned = value.replace(/[£,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const pence = Math.round(Number(cleaned) * 100);
  return pence <= MAX_DRONE_FEE_PENCE ? pence : null;
}

/** Fee as typed back into an input, without a currency symbol. */
export function inputFromPence(pence: number): string {
  return pence % 100 === 0 ? String(pence / 100) : (pence / 100).toFixed(2);
}

export type DroneQuoteLine = {
  label: string;
  /** "£150" when charged separately, "Included" otherwise. */
  amount: string;
};

/** The quote line for a drone, or null when no drone is used. */
export function droneQuoteLine(input: {
  drone: Pick<SurveyDrone, 'used' | 'billing' | 'feePence'>;
  defaultFeePence: number;
  currency?: string;
}): DroneQuoteLine | null {
  if (!input.drone.used) return null;
  if (input.drone.billing === 'included') {
    return { label: 'Drone', amount: 'Included' };
  }
  return {
    label: 'Drone',
    amount: formatDroneFee(
      effectiveDroneFeePence(input.drone, input.defaultFeePence),
      input.currency,
    ),
  };
}

/** The A. About the inspection entry in the report. */
export function droneReportText(used: boolean): string {
  return used
    ? 'Yes. A drone was used to inspect roof coverings and other areas that could not safely be seen from ground level.'
    : 'No.';
}
