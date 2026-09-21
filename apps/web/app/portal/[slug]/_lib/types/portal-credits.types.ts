/**
 * Client-portal credit top-up packs (GBP).
 * Pack sizes are display credits only — never mention time equivalents in UI.
 */
export const PORTAL_CREDIT_TOPUP_PACKS = [
  { id: 'small', units: 40, totalPence: 3500, label: '40 credits' },
  { id: 'medium', units: 80, totalPence: 7000, label: '80 credits' },
  { id: 'large', units: 160, totalPence: 14000, label: '160 credits' },
] as const;

export type PortalCreditTopupPackId =
  (typeof PORTAL_CREDIT_TOPUP_PACKS)[number]['id'];

export type PortalCreditTransaction = {
  id: string;
  type: string;
  amount: number;
  reason: string | null;
  createdAt: string;
  relatedTicketId: string | null;
};

export type PortalCreditsBundle = {
  balance: number;
  cycleStart: string | null;
  cycleEnd: string | null;
  rolloverPolicy: 'expire' | 'rollover' | 'cap' | null;
  rolloverCap: number | null;
  creditsPerCycle: number | null;
  planName: string | null;
  planProjectName: string | null;
  nextRenewalDate: string | null;
  transactions: PortalCreditTransaction[];
  requestTypes: Array<{
    id: string;
    label: string;
    creditCost: number;
    isBillable: boolean;
    isSupport: boolean;
    categoryGroup: string | null;
  }>;
  topupPacks: Array<{
    id: string;
    units: number;
    totalPence: number;
    label: string;
  }>;
  pendingCreditTicketCount: number;
  pendingPlans: Array<{
    id: string;
    planName: string;
    amountPence: number;
    currency: string;
    projectName: string | null;
  }>;
};
