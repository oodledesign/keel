import type { SupabaseClient } from '@supabase/supabase-js';

import {
  DEFAULT_SES_CONFIGURATION_SET,
  sesTenantNameForAccount,
  type SesIdentityAdmin,
} from '@kit/ses/identity';

import { buildSendingDnsRecords, type SendingDnsRecord } from './dns-records';
import {
  SendingDomainError,
  normalizeSendingDomain,
  normalizeSendingLocalPart,
  overallVerificationStatus,
} from './domain';
import {
  ACCOUNT_SENDING_DOMAINS_TABLE,
  type SendingDomainRecord,
} from './types';

const MAIL_FROM_SUBDOMAIN = 'bounce';

function isMissingTableError(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /account_sending_domains/i.test(error.message ?? '')
  );
}

function fromTable(client: SupabaseClient) {
  // Table is added via SQL migration; generated types land after Dan applies it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from(ACCOUNT_SENDING_DOMAINS_TABLE);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function asDnsRecords(value: unknown): SendingDnsRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is SendingDnsRecord => {
    return (
      Boolean(item) &&
      typeof item === 'object' &&
      'type' in item &&
      'host' in item &&
      'value' in item
    );
  });
}

function mapRow(row: Record<string, unknown>): SendingDomainRecord {
  const verification = row.verification_status;
  const status =
    verification === 'verified' ||
    verification === 'failed' ||
    verification === 'pending'
      ? verification
      : overallVerificationStatus({
          dkim_status: String(row.dkim_status ?? 'pending'),
          mail_from_status: String(row.mail_from_status ?? 'pending'),
        });

  return {
    id: String(row.id),
    account_id: String(row.account_id),
    domain: String(row.domain),
    mail_from_subdomain: String(row.mail_from_subdomain ?? MAIL_FROM_SUBDOMAIN),
    default_local_part: String(row.default_local_part ?? 'listings'),
    ses_identity_name: (row.ses_identity_name as string | null) ?? null,
    ses_identity_arn: (row.ses_identity_arn as string | null) ?? null,
    ses_tenant_name: (row.ses_tenant_name as string | null) ?? null,
    ses_configuration_set: (row.ses_configuration_set as string | null) ?? null,
    dkim_tokens: asStringArray(row.dkim_tokens),
    dns_records: asDnsRecords(row.dns_records),
    dkim_status: String(row.dkim_status ?? 'pending'),
    mail_from_status: String(row.mail_from_status ?? 'pending'),
    verification_status: status,
    verified_at: (row.verified_at as string | null) ?? null,
    created_by: (row.created_by as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

async function assertBusinessWorkspace(
  client: SupabaseClient,
  accountId: string,
) {
  const { data, error } = await client
    .from('accounts')
    .select('id, name, is_personal_account, space_type')
    .eq('id', accountId)
    .maybeSingle();

  if (error) {
    throw new SendingDomainError(error.message);
  }

  if (!data) {
    throw new SendingDomainError('Workspace not found');
  }

  const account = data as {
    id: string;
    name: string | null;
    is_personal_account: boolean | null;
    space_type: string | null;
  };

  if (account.is_personal_account) {
    throw new SendingDomainError(
      'Sending domains are only available on business workspaces.',
    );
  }

  if (account.space_type === 'family') {
    throw new SendingDomainError(
      'Sending domains are not available on family workspaces.',
    );
  }

  return account;
}

export function createSendingDomainService(
  client: SupabaseClient,
  ses: SesIdentityAdmin,
) {
  return new SendingDomainService(client, ses);
}

class SendingDomainService {
  constructor(
    private readonly client: SupabaseClient,
    private readonly ses: SesIdentityAdmin,
  ) {}

  async getForAccount(accountId: string): Promise<SendingDomainRecord | null> {
    const { data, error } = await fromTable(this.client)
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle();

    if (error) {
      if (isMissingTableError(error)) {
        return null;
      }
      throw new SendingDomainError(error.message);
    }

    return data ? mapRow(data as Record<string, unknown>) : null;
  }

  async createDomain(input: {
    accountId: string;
    domain: string;
    userId: string;
    localPart?: string;
  }): Promise<SendingDomainRecord> {
    await assertBusinessWorkspace(this.client, input.accountId);
    const domain = normalizeSendingDomain(input.domain);
    const localPart = normalizeSendingLocalPart(
      input.localPart?.trim() || 'listings',
    );

    const existing = await this.getForAccount(input.accountId);
    if (existing) {
      throw new SendingDomainError(
        'This workspace already has a sending domain. Remove it before adding another.',
      );
    }

    const { data: claimed, error: claimedError } = await fromTable(this.client)
      .select('account_id')
      .eq('domain', domain)
      .maybeSingle();

    if (claimedError) {
      throw new SendingDomainError(claimedError.message);
    }

    if (claimed && String(claimed.account_id) !== input.accountId) {
      throw new SendingDomainError(
        'That domain is already connected to another workspace.',
      );
    }

    const identity = await this.ses.createDomainIdentity(domain);
    const mailFromDomain = `${MAIL_FROM_SUBDOMAIN}.${domain}`;
    await this.ses.putMailFrom(domain, mailFromDomain);

    const configurationSetName =
      process.env.SES_CONFIGURATION_SET?.trim() ||
      DEFAULT_SES_CONFIGURATION_SET;
    const configSet = await this.ses.ensureConfigurationSet(
      configurationSetName,
    );
    const tenantName = sesTenantNameForAccount(input.accountId);
    await this.ses.ensureTenant(tenantName);
    await this.ses.associateTenantResource(tenantName, identity.identityArn);
    await this.ses.associateTenantResource(tenantName, configSet.arn);

    const dnsRecords = buildSendingDnsRecords({
      domain,
      tokens: identity.tokens,
      region: this.ses.getRegion(),
      mailFromSubdomain: MAIL_FROM_SUBDOMAIN,
    });

    const { data, error } = await fromTable(this.client)
      .insert({
        account_id: input.accountId,
        domain,
        mail_from_subdomain: MAIL_FROM_SUBDOMAIN,
        default_local_part: localPart,
        ses_identity_name: domain,
        ses_identity_arn: identity.identityArn,
        ses_tenant_name: tenantName,
        ses_configuration_set: configurationSetName,
        dkim_tokens: identity.tokens,
        dns_records: dnsRecords,
        dkim_status: 'pending',
        mail_from_status: 'pending',
        verification_status: 'pending',
        created_by: input.userId,
      })
      .select('*')
      .single();

    if (error || !data) {
      if (error?.code === '23505') {
        throw new SendingDomainError(
          'That domain is already connected to another workspace.',
        );
      }
      throw new SendingDomainError(
        error?.message ?? 'Could not save the sending domain.',
      );
    }

    return mapRow(data as Record<string, unknown>);
  }

  async refreshStatus(accountId: string): Promise<SendingDomainRecord | null> {
    const existing = await this.getForAccount(accountId);
    if (!existing) {
      return null;
    }

    const snapshot = await this.ses.getDomainIdentity(existing.domain);
    const dkimStatus = snapshot.dkimStatus || 'pending';
    const mailFromStatus = snapshot.mailFromStatus || 'pending';
    const verificationStatus = overallVerificationStatus({
      dkim_status: dkimStatus,
      mail_from_status: mailFromStatus,
    });
    const tokens = snapshot.tokens.length
      ? snapshot.tokens
      : existing.dkim_tokens;
    const dnsRecords = buildSendingDnsRecords({
      domain: existing.domain,
      tokens,
      region: this.ses.getRegion(),
      mailFromSubdomain: existing.mail_from_subdomain || MAIL_FROM_SUBDOMAIN,
    });

    const { data, error } = await fromTable(this.client)
      .update({
        dkim_tokens: tokens,
        dns_records: dnsRecords,
        dkim_status: dkimStatus,
        mail_from_status: mailFromStatus,
        verification_status: verificationStatus,
        verified_at:
          verificationStatus === 'verified'
            ? (existing.verified_at ?? new Date().toISOString())
            : null,
        ses_identity_arn: snapshot.identityArn || existing.ses_identity_arn,
      })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error || !data) {
      throw new SendingDomainError(
        error?.message ?? 'Could not refresh sending domain status.',
      );
    }

    return mapRow(data as Record<string, unknown>);
  }

  async updateLocalPart(
    accountId: string,
    localPart: string,
  ): Promise<SendingDomainRecord> {
    const existing = await this.getForAccount(accountId);
    if (!existing) {
      throw new SendingDomainError('Add a sending domain first.');
    }

    const normalized = normalizeSendingLocalPart(localPart);
    const { data, error } = await fromTable(this.client)
      .update({ default_local_part: normalized })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error || !data) {
      throw new SendingDomainError(
        error?.message ?? 'Could not update the From address.',
      );
    }

    return mapRow(data as Record<string, unknown>);
  }

  async removeDomain(accountId: string): Promise<void> {
    const existing = await this.getForAccount(accountId);
    if (!existing) {
      return;
    }

    if (existing.ses_tenant_name && existing.ses_identity_arn) {
      await this.ses.disassociateTenantResource(
        existing.ses_tenant_name,
        existing.ses_identity_arn,
      );
    }

    if (existing.ses_tenant_name && existing.ses_configuration_set) {
      try {
        const configArn = (
          await this.ses.ensureConfigurationSet(existing.ses_configuration_set)
        ).arn;
        await this.ses.disassociateTenantResource(
          existing.ses_tenant_name,
          configArn,
        );
      } catch {
        // Shared configuration set can stay; tenant teardown still proceeds.
      }
    }

    if (existing.ses_tenant_name) {
      await this.ses.deleteTenant(existing.ses_tenant_name);
    }

    if (existing.domain) {
      await this.ses.deleteIdentity(existing.domain);
    }

    const { error } = await fromTable(this.client)
      .delete()
      .eq('id', existing.id);

    if (error) {
      throw new SendingDomainError(error.message);
    }
  }

}

export async function loadAccountSendingDomain(
  client: SupabaseClient,
  accountId: string,
): Promise<SendingDomainRecord | null> {
  const { data, error } = await fromTable(client)
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      return null;
    }
    throw new SendingDomainError(error.message);
  }

  return data ? mapRow(data as Record<string, unknown>) : null;
}
