export type ApiTokenListItem = {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
};

export type ValidatedApiToken = {
  id: string;
  account_id: string;
  user_id: string;
  name: string;
};
