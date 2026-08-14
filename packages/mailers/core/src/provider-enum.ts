import { z } from 'zod';

const MAILER_PROVIDERS = ['nodemailer', 'resend', 'ses', 'zeptomail'] as const;

const MAILER_PROVIDER = z
  .enum(MAILER_PROVIDERS)
  .default('nodemailer')
  .parse(process.env.MAILER_PROVIDER);

/**
 * Resolve which mailer to use at runtime.
 * Prefer Zepto whenever ZEPTOMAIL_TOKEN is set (Ozer production / staging).
 *
 * Local Inbucket: set MAILER_PROVIDER=nodemailer and either unset
 * ZEPTOMAIL_TOKEN or set MAILER_FORCE_SMTP=true.
 */
export function resolveMailerProvider(): MailerProvider {
  const configured = MAILER_PROVIDER;
  const forceSmtp = process.env.MAILER_FORCE_SMTP === 'true';
  const hasZepto = Boolean(process.env.ZEPTOMAIL_TOKEN?.trim());

  if (forceSmtp && configured === 'nodemailer') {
    return 'nodemailer';
  }

  if (hasZepto || configured === 'zeptomail') {
    return 'zeptomail';
  }

  return configured;
}

export { MAILER_PROVIDER };

export type MailerProvider = (typeof MAILER_PROVIDERS)[number];
