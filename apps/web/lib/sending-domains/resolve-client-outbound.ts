import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { canUseCustomSendingDomain } from '~/lib/billing/can-use-custom-sending-domain';
import {
  type OutboundEmailFeature,
  parseOutboundEmailSettings,
  shouldUseCustomSendingDomain,
} from '~/lib/billing/outbound-email-settings';
import { fromAccountsUntyped } from '~/lib/supabase/accounts-table';

import { isSendingDomainVerified } from './domain';
import { getPlatformSesFrom, resolveWorkspaceMailFrom } from './resolve-from';
import { loadAccountSendingDomain } from './sending-domain.service';
import type { ResolvedWorkspaceMailFrom } from './types';

export type ResolvedClientOutbound = ResolvedWorkspaceMailFrom & {
  mailer: 'ses' | 'platform';
  usedCustomDomain: boolean;
  feature: OutboundEmailFeature;
};

export async function resolveClientOutboundFrom(input: {
  client: SupabaseClient;
  accountId: string;
  accountName: string;
  feature: OutboundEmailFeature;
  displayName?: string | null;
  brandContactEmail?: string | null;
  businessType?: string | null;
}): Promise<ResolvedClientOutbound> {
  const [allowedByPlan, domain, accountRow] = await Promise.all([
    canUseCustomSendingDomain(
      input.client,
      input.accountId,
      input.businessType,
    ),
    loadAccountSendingDomain(input.client, input.accountId),
    fromAccountsUntyped(input.client)
      .select('outbound_email_settings')
      .eq('id', input.accountId)
      .maybeSingle(),
  ]);

  const settings = parseOutboundEmailSettings(
    (accountRow.data as { outbound_email_settings?: unknown } | null)
      ?.outbound_email_settings,
  );
  const domainVerified = Boolean(domain && isSendingDomainVerified(domain));
  const useCustom = shouldUseCustomSendingDomain({
    allowedByPlan,
    featureEnabled: settings[input.feature],
    domainVerified,
  });

  const resolved = resolveWorkspaceMailFrom({
    accountName: input.accountName,
    brandContactEmail: input.brandContactEmail,
    proposedFromName: input.displayName,
    sendingDomain: useCustom ? domain : null,
    platformFrom: getPlatformSesFrom(),
  });

  const usedCustomDomain = useCustom && resolved.source === 'custom_domain';

  return {
    ...resolved,
    mailer: usedCustomDomain ? 'ses' : 'platform',
    usedCustomDomain,
    feature: input.feature,
  };
}
