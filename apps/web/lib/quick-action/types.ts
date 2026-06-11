export type QuickActionPageContext = {
  accountId?: string;
  accountSlug?: string;
};

export type QuickActionPreviewCreateTask = {
  type: 'create_task';
  workspaceName: string;
  workspaceSlug: string;
  accountId: string;
  title: string;
  notes: string | null;
  dueDate: string | null;
  priority: string;
  projectName: string | null;
  clientName: string | null;
};

export type QuickActionPreviewPagespeed = {
  type: 'pagespeed_scan';
  workspaceName: string;
  workspaceSlug: string;
  accountId: string;
  projectId: string;
  projectName: string;
  domain: string;
};

export type QuickActionPreview =
  | QuickActionPreviewCreateTask
  | QuickActionPreviewPagespeed;

export type ProposedQuickAction = {
  actionToken: string;
  preview: QuickActionPreview;
};

export type CreateTaskActionData = {
  type: 'create_task';
  accountId: string;
  title: string;
  notes: string | null;
  dueDate: string | null;
  priority: string;
  projectId: string | null;
  clientId: string | null;
};

export type PagespeedActionData = {
  type: 'pagespeed_scan';
  accountId: string;
  projectId: string;
};

export type QuickActionTokenPayload = {
  userId: string;
  exp: number;
  data: CreateTaskActionData | PagespeedActionData;
};

export type QuickActionPlanResponse = {
  assistantMessage: string;
  proposedActions: ProposedQuickAction[];
};

export type QuickActionExecuteResponse = {
  success: boolean;
  message: string;
  link: string | null;
  entityId: string | null;
};

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  typeLabel: string;
};
