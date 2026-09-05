/**
 * Client-safe Circulation meter types. Distinct from Campaigns credits.
 */

export type CirculationUsageSnapshot = {
  emailsSent: number;
  monthlyAllowance: number;
  maxContacts: number;
  contactsUsed: number;
  cycleEnd: string | null;
};
