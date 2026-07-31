export type ProjectGuestPermissions = {
  comment: boolean;
  create_task: boolean;
  edit_own_task: boolean;
};

export type ProjectGuest = {
  id: string;
  projectId: string;
  accountId: string;
  userId: string | null;
  invitedEmail: string;
  invitedBy: string;
  permissions: ProjectGuestPermissions;
  status: 'pending' | 'accepted' | 'revoked';
  /** Present on create/accept/token lookup; omitted from host list responses. */
  inviteToken?: string;
  createdAt: string;
  acceptedAt: string | null;
  projectName: string | null;
  accountSlug: string | null;
  accountName: string | null;
};
