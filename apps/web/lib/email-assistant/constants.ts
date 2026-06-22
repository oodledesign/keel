export const GMAIL_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  // Gmail vacation responder (Focus holiday mode sync)
  'https://www.googleapis.com/auth/gmail.settings.basic',
] as const;

export const EMAIL_ASSISTANT_DEFAULT_RETURN_PATH = '/app/email';
