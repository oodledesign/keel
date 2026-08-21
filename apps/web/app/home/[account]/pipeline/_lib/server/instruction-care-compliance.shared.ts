/**
 * Shared types/constants for instruction care + compliance (not a server-actions module).
 */

/**
 * PLACEHOLDER checklist — swap for Bracketts-confirmed compliance items
 * after Friday's discussion. Labels below are demo-only generics.
 */
export const PLACEHOLDER_COMPLIANCE_LABELS = [
  'Terms of business signed',
  'EPC obtained',
  'Marketing consent confirmed',
  'Title documents received',
] as const;

export type InstructionCareLogEntry = {
  id: string;
  note: string;
  createdAt: string;
  createdBy: string;
};

export type InstructionComplianceItem = {
  id: string;
  label: string;
  isChecked: boolean;
  checkedAt: string | null;
  sortOrder: number;
};
