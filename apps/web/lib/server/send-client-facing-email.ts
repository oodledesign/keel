import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import type { OutboundEmailFeature } from '~/lib/billing/outbound-email-settings';
import { resolveTransactionalEmailFrom } from '~/lib/email/zeptomail-client';
import { resolveClientOutboundFrom } from '~/lib/sending-domains/resolve-client-outbound';

import {
  type PlatformEmailType,
  sendPlatformEmail,
} from './send-platform-email';

type ClientFacingMail = {
  to: string;
  subject: string;
  cc?: string[];
  replyTo?: string;
  attachments?: Array<{
    name: string;
    content: string;
    mimeType: string;
  }>;
} & ({ html: string } | { text: string });

/**
 * Client-facing transactional email. Uses the workspace sending domain when
 * the plan is Starter/Pro, the domain is verified, and the feature toggle is on.
 * Otherwise sends from the Ozer default domain (Zepto/Resend).
 */
export async function sendClientFacingEmail(params: {
  type: PlatformEmailType;
  accountId: string;
  feature: OutboundEmailFeature;
  accountName?: string | null;
  displayName?: string | null;
  /** Display name for the platform rail (Zepto/Resend) fallback sender. */
  platformDisplayName?: string | null;
  /** Force platform rail From even when a custom domain exists. */
  forcePlatformFrom?: boolean;
  brandContactEmail?: string | null;
  mail: ClientFacingMail;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const admin = getSupabaseServerAdminClient();
  const accountName = params.accountName?.trim() || 'Ozer';

  const resolved = await resolveClientOutboundFrom({
    client: admin,
    accountId: params.accountId,
    accountName,
    feature: params.feature,
    displayName: params.displayName,
    brandContactEmail: params.brandContactEmail,
  });

  const platformDisplayName =
    params.platformDisplayName?.trim() ||
    params.displayName?.trim() ||
    accountName;
  const platformFrom = resolveTransactionalEmailFrom(platformDisplayName);
  const useCustomDomainFrom =
    resolved.usedCustomDomain && params.forcePlatformFrom !== true;

  // Custom SES domains may From as the workspace address. The platform
  // Zepto/Resend rail must use its configured sender address.
  const from = useCustomDomainFrom
    ? resolved.fromHeader || platformFrom
    : platformFrom;

  if (!from) {
    throw new Error(
      'No email sender configured (set ZEPTOMAIL_FROM_ADDRESS, EMAIL_SENDER, or SES_FROM_ADDRESS).',
    );
  }

  await sendPlatformEmail({
    type: params.type,
    accountId: params.accountId,
    mail: {
      ...params.mail,
      from,
      replyTo: params.mail.replyTo ?? resolved.replyTo ?? undefined,
    },
    metadata: {
      outbound_feature: params.feature,
      outbound_source: useCustomDomainFrom ? resolved.source : 'platform',
      used_custom_domain: useCustomDomainFrom,
      ...(params.metadata ?? {}),
    },
    ses:
      useCustomDomainFrom && resolved.mailer === 'ses'
        ? {
            tenant: resolved.sesTenantName,
            configurationSet: resolved.sesConfigurationSet,
          }
        : undefined,
  });
}
