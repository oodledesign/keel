export type RequestTypeRecord = {
  id: string;
  accountId: string;
  businessId: string | null;
  label: string;
  creditCost: number;
  isBillable: boolean;
  categoryGroup: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
