export type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

export type GoogleConnectionTokens = {
  googleEmail: string;
  access: string;
  refresh: string | null;
  expiresAt: string | null;
};
