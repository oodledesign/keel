export type ClientPortalInviteStatus = 'pending' | 'accepted' | 'revoked';

export type ClientPortalInvite = {
  id: string;
  accountId: string;
  clientId: string;
  clientOrgId: string;
  contactId: string | null;
  invitedEmail: string;
  invitedBy: string;
  userId: string | null;
  role: 'owner' | 'member' | 'viewer';
  status: ClientPortalInviteStatus;
  createdAt: string;
  acceptedAt: string | null;
  clientOrgSlug: string | null;
  clientOrgName: string | null;
  accountSlug: string | null;
  accountName: string | null;
  inviteToken?: string;
};

export type ContactPortalAccessStatus =
  | 'not_invited'
  | 'invited'
  | 'active'
  | 'revoked';

export type ContactPortalAccess = {
  contactId: string;
  email: string | null;
  status: ContactPortalAccessStatus;
  inviteId: string | null;
  lastLogin: string | null;
};
