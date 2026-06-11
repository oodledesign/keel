export const EMAIL_CONTACT_TRADE_OPTIONS = [
  'Interior Designer',
  'General Builder',
  'Carpenter',
  'Plumber',
  'Electrician',
  'Plasterer',
  'Tiler',
  'Decorator',
  'Roofer',
  'Landscaper',
  'Other',
] as const;

export const EMAIL_CONTACT_SOURCES = [
  'manual',
  'interest_form',
  'imported',
  'beta',
] as const;

export type EmailContactSource = (typeof EMAIL_CONTACT_SOURCES)[number];
