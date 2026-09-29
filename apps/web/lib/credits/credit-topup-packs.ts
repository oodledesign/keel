import { z } from 'zod';

/**
 * Client-portal credit top-up packs (GBP). Workspaces can override these in
 * Settings → Services; `null` settings fall back to the defaults.
 * Pack sizes are display credits only — never mention time equivalents in UI.
 */
export type CreditTopupPack = {
  id: string;
  units: number;
  totalPence: number;
  label: string;
};

export const MAX_CREDIT_TOPUP_PACKS = 6;

export const DEFAULT_CREDIT_TOPUP_PACK_VALUES = [
  { units: 40, totalPence: 3500 },
  { units: 80, totalPence: 7000 },
  { units: 160, totalPence: 14000 },
] as const;

export const CreditTopupPackInputSchema = z.object({
  units: z.number().int().min(1).max(100_000),
  totalPence: z.number().int().min(100).max(10_000_000),
});

export const CreditTopupPackListSchema = z
  .array(CreditTopupPackInputSchema)
  .max(MAX_CREDIT_TOPUP_PACKS)
  .refine(
    (packs) => new Set(packs.map((pack) => pack.units)).size === packs.length,
    { message: 'Each pack needs a different number of credits' },
  );

export type CreditTopupPackInput = z.infer<typeof CreditTopupPackInputSchema>;

export function creditTopupPackId(units: number): string {
  return `${units}-credits`;
}

export function toCreditTopupPacks(
  values: ReadonlyArray<CreditTopupPackInput>,
): CreditTopupPack[] {
  return [...values]
    .sort((a, b) => a.units - b.units)
    .map((value) => ({
      id: creditTopupPackId(value.units),
      units: value.units,
      totalPence: value.totalPence,
      label: `${value.units} credits`,
    }));
}

export const DEFAULT_CREDIT_TOPUP_PACKS = toCreditTopupPacks(
  DEFAULT_CREDIT_TOPUP_PACK_VALUES,
);

/**
 * Resolve stored `account_credit_settings.topup_packs`. Returns the defaults
 * when nothing valid is stored; an explicit empty array turns top-ups off.
 */
export function resolveCreditTopupPacks(stored: unknown): {
  packs: CreditTopupPack[];
  isCustom: boolean;
} {
  if (stored === null || stored === undefined) {
    return { packs: DEFAULT_CREDIT_TOPUP_PACKS, isCustom: false };
  }

  const parsed = CreditTopupPackListSchema.safeParse(stored);
  if (!parsed.success) {
    return { packs: DEFAULT_CREDIT_TOPUP_PACKS, isCustom: false };
  }

  return { packs: toCreditTopupPacks(parsed.data), isCustom: true };
}
