import { MAILER_PROVIDER, resolveMailerProvider } from './provider-enum';
import { mailerRegistry } from './registry';

/**
 * @name getMailer
 * @description Get the mailer based on env. Prefers Zepto when ZEPTOMAIL_TOKEN is set.
 */
export function getMailer() {
  return mailerRegistry.get(resolveMailerProvider());
}

export { MAILER_PROVIDER, resolveMailerProvider };
export { sanitizeEmailSender } from '@kit/mailers-shared';
