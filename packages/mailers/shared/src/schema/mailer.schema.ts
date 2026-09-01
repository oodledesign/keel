import { z } from 'zod';

export const MailerSchema = z
  .object({
    to: z.string().email(),
    // this is not necessarily formatted
    // as an email so we type it loosely
    from: z.string().min(1),
    subject: z.string(),
    replyTo: z.string().email().optional(),
    /** Absolute unsubscribe URL for List-Unsubscribe header (marketing/circulation). */
    listUnsubscribeUrl: z.string().url().optional(),
    /** SES tenant name (SendRawEmail / SMTP: X-SES-TENANT). */
    sesTenant: z.string().min(1).optional(),
    /** SES configuration set (SendRawEmail param + X-SES-CONFIGURATION-SET). */
    sesConfigurationSet: z.string().min(1).optional(),
  })
  .and(
    z.union([
      z.object({
        text: z.string(),
      }),
      z.object({
        html: z.string(),
      }),
    ]),
  );
