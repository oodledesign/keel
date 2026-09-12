import type {
  RetainerMatchKind,
  RetainerSuggestionStatus,
  TaskStatusValue,
} from './constants';

export type RetainerServiceRecord = {
  id: string;
  accountId: string;
  name: string;
  description: string | null;
  creditCost: number;
  defaultStatus: TaskStatusValue | null;
  defaultAssigneeId: string | null;
  defaultDurationMinutes: number | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ProjectRetainerRecord = {
  projectId: string;
  accountId: string;
  creditBalance: number;
  autoMatchEnabled: boolean;
  weeklyDigestEnabled: boolean;
  allowedServiceIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type ProjectRetainerBurn = {
  id: string;
  amount: number;
  serviceId: string | null;
  serviceName: string | null;
  taskId: string | null;
  taskTitle: string | null;
  createdAt: string;
  type: 'grant' | 'burn' | 'undo' | 'adjust' | 'debit';
};

export type RetainerMatchSuggestion = {
  id: string;
  accountId: string;
  projectId: string | null;
  clientId: string | null;
  emailThreadId: string | null;
  emailActionItemId: string | null;
  matchKind: RetainerMatchKind;
  serviceId: string | null;
  serviceName: string | null;
  proposedName: string | null;
  proposedDescription: string | null;
  proposedCreditCost: number | null;
  confidence: number | null;
  rationale: string | null;
  creditCost: number | null;
  status: RetainerSuggestionStatus;
  taskId: string | null;
  appliedAt: string | null;
  createdAt: string;
};

export type LadderService = {
  id: string;
  name: string;
  description: string | null;
  creditCost: number;
};

export type LadderPools = {
  projectServices: LadderService[];
  workspaceOnlyServices: LadderService[];
};
