import {
  emailDomainOf,
  extractEmailAddress,
  formatSendingFromAddress,
  isSendingDomainVerified,
  resolveSendingHost,
} from './domain';
import type { ResolvedWorkspaceMailFrom } from './types';

export type SendingDomainFromInput = {
  domain: string;
  sending_subdomain?: string | null;
  default_local_part: string;
  dkim_status: string;
  mail_from_status: string;
  ses_tenant_name?: string | null;
  ses_configuration_set?: string | null;
};

function formatFromHeader(name: string, email: string) {
  const display = name.trim();
  return display ? `${display} <${email}>` : email;
}

function isOnUnverifiedCustomDomain(
  email: string,
  sendingDomain: SendingDomainFromInput | null,
) {
  if (!sendingDomain || isSendingDomainVerified(sendingDomain)) {
    return false;
  }

  return (
    emailDomainOf(email) ===
    resolveSendingHost(sendingDomain.domain, sendingDomain.sending_subdomain)
  );
}

export function getPlatformSesFrom(
  env: Record<string, string | undefined> = process.env,
): string | null {
  return env.SES_FROM_ADDRESS?.trim() || env.EMAIL_SENDER?.trim() || null;
}

export function resolveWorkspaceMailFrom(input: {
  accountName: string;
  brandContactEmail?: string | null;
  proposedFromEmail?: string | null;
  proposedFromName?: string | null;
  sendingDomain: SendingDomainFromInput | null;
  platformFrom?: string | null;
}): ResolvedWorkspaceMailFrom {
  const accountName = input.accountName.trim() || 'Agency';
  const replyFallback =
    input.brandContactEmail?.trim() || input.proposedFromEmail?.trim() || null;

  if (input.sendingDomain && isSendingDomainVerified(input.sendingDomain)) {
    const fromEmail = formatSendingFromAddress({
      localPart: input.sendingDomain.default_local_part,
      domain: input.sendingDomain.domain,
      sendingSubdomain: input.sendingDomain.sending_subdomain,
    });
    const fromName = accountName;

    return {
      fromEmail,
      fromName,
      fromHeader: formatFromHeader(fromName, fromEmail),
      replyTo: replyFallback || fromEmail,
      source: 'custom_domain',
      sesTenantName: input.sendingDomain.ses_tenant_name ?? null,
      sesConfigurationSet: input.sendingDomain.ses_configuration_set ?? null,
      verifiedCustomDomain: true,
    };
  }

  const proposed =
    input.proposedFromEmail?.trim() || input.brandContactEmail?.trim() || null;
  const proposedUsable =
    proposed && !isOnUnverifiedCustomDomain(proposed, input.sendingDomain)
      ? proposed
      : null;

  if (proposedUsable) {
    const fromName = input.proposedFromName?.trim() || accountName;
    return {
      fromEmail: proposedUsable,
      fromName,
      fromHeader: formatFromHeader(fromName, proposedUsable),
      replyTo: replyFallback || proposedUsable,
      source: 'existing',
      sesTenantName: null,
      sesConfigurationSet: null,
      verifiedCustomDomain: false,
    };
  }

  const platform = input.platformFrom?.trim() || null;
  if (platform) {
    const fromEmail = extractEmailAddress(platform);
    const fromName = input.proposedFromName?.trim() || accountName;
    return {
      fromEmail,
      fromName,
      fromHeader: formatFromHeader(fromName, fromEmail),
      replyTo: replyFallback || fromEmail,
      source: 'platform',
      sesTenantName: null,
      sesConfigurationSet: null,
      verifiedCustomDomain: false,
    };
  }

  return {
    fromEmail: null,
    fromName: accountName,
    fromHeader: null,
    replyTo: replyFallback,
    source: 'platform',
    sesTenantName: null,
    sesConfigurationSet: null,
    verifiedCustomDomain: false,
  };
}
