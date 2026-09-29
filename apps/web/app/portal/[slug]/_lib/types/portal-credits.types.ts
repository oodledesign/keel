import type { CreditTopupPack } from '~/lib/credits/credit-topup-packs';

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
  /** Empty while a retainer is awaiting payment or top-ups are turned off. */
  topupPacks: CreditTopupPack[];
  pendingCreditTicketCount: number;
  pendingPlans: Array<{
    id: string;
    planName: string;
    amountPence: number;
    currency: string;
    projectName: string | null;
  }>;
};
