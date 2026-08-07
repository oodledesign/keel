export const PORTAL_CREDIT_TOPUP_PACKS = [
  { id: 'small', units: 10, totalPence: 5000, label: '10 credits' },
  { id: 'medium', units: 25, totalPence: 10000, label: '25 credits' },
  { id: 'large', units: 50, totalPence: 17500, label: '50 credits' },
] as const;

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
  nextRenewalDate: string | null;
  transactions: PortalCreditTransaction[];
  requestTypes: Array<{
    id: string;
    label: string;
    creditCost: number;
    isBillable: boolean;
    categoryGroup: string | null;
  }>;
  topupPacks: Array<{
    id: string;
    units: number;
    totalPence: number;
    label: string;
  }>;
  pendingCreditTicketCount: number;
};
