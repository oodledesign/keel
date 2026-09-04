import { randomBytes } from 'crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  DEFAULT_SES_CONFIGURATION_SET,
  type SesIdentityAdmin,
  isSesAccessDeniedError,
  mapSesIdentityAdminError,
  sesTenantNameForAccount,
} from '@kit/ses/identity';

import { type SendingDnsRecord, buildSendingDnsRecords } from './dns-records';
import {
  DEFAULT_MAIL_FROM_SUBDOMAIN,
  DEFAULT_SENDING_LOCAL_PART,
  DEFAULT_SENDING_SUBDOMAIN,
  SendingDomainError,
  normalizeSendingDomain,
  normalizeSendingLocalPart,
  normalizeSendingSubdomain,
  overallVerificationStatus,
  resolveMailFromHost,
  resolveSendingHost,
} from './domain';
import {
  ACCOUNT_SENDING_DOMAINS_TABLE,
  type PublicSendingDomainInstructions,
  type SendingDomainRecord,
} from './types';

const MAIL_FROM_SUBDOMAIN = DEFAULT_MAIL_FROM_SUBDOMAIN;

function generateInstructionsShareToken() {
  return randomBytes(24).toString('hex');
}

function isMissingTableError(
  error: { message?: string; code?: string } | null,
) {
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
    sending_subdomain:
      typeof row.sending_subdomain === 'string' && row.sending_subdomain.trim()
        ? row.sending_subdomain.trim().toLowerCase()
        : null,
    sending_host:
      typeof row.sending_host === 'string' && row.sending_host.trim()
        ? row.sending_host.trim().toLowerCase()
        : resolveSendingHost(
            String(row.domain),
            typeof row.sending_subdomain === 'string'
              ? row.sending_subdomain
              : null,
          ),
    mail_from_subdomain: String(row.mail_from_subdomain ?? MAIL_FROM_SUBDOMAIN),
    default_local_part: String(
      row.default_local_part ?? DEFAULT_SENDING_LOCAL_PART,
    ),
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
    instructions_share_token:
      typeof row.instructions_share_token === 'string' &&
      row.instructions_share_token.trim()
        ? row.instructions_share_token.trim()
        : null,
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
    sendingSubdomain?: string | null;
  }): Promise<SendingDomainRecord> {
    await assertBusinessWorkspace(this.client, input.accountId);
    const domain = normalizeSendingDomain(input.domain);
    const sendingSubdomain =
      input.sendingSubdomain === undefined
        ? DEFAULT_SENDING_SUBDOMAIN
        : normalizeSendingSubdomain(input.sendingSubdomain);
    const sendingHost = resolveSendingHost(domain, sendingSubdomain);
    const localPart = normalizeSendingLocalPart(
      input.localPart?.trim() || DEFAULT_SENDING_LOCAL_PART,
    );

    const existing = await this.getForAccount(input.accountId);
    if (existing) {
      throw new SendingDomainError(
        'This workspace already has a sending domain. Remove it before adding another.',
      );
    }

    await this.assertUnclaimedIdentity(input.accountId, domain, sendingHost);

    let identityCreated = false;

    try {
      const identity = await this.ses.createDomainIdentity(sendingHost);
      identityCreated = true;

      const mailFromDomain = resolveMailFromHost(
        sendingHost,
        MAIL_FROM_SUBDOMAIN,
      );
      await this.ses.putMailFrom(sendingHost, mailFromDomain);

      const configurationSetName =
        process.env.SES_CONFIGURATION_SET?.trim() ||
        DEFAULT_SES_CONFIGURATION_SET;
      const configSet =
        await this.ses.ensureConfigurationSet(configurationSetName);

      // Tenants isolate reputation via X-SES-TENANT. If the IAM user cannot
      // create/associate tenants (feature not enabled or missing IAM), soft-fail
      // and continue — sending still works without a tenant.
      let tenantName: string | null = sesTenantNameForAccount(input.accountId);
      try {
        await this.ses.ensureTenant(tenantName);
        await this.ses.associateTenantResource(
          tenantName,
          identity.identityArn,
        );
        await this.ses.associateTenantResource(tenantName, configSet.arn);
      } catch (tenantError) {
        if (!isSesAccessDeniedError(tenantError)) {
          throw tenantError;
        }

        console.warn(
          '[sending-domains] SES tenant setup AccessDenied; continuing without tenant',
          {
            accountId: input.accountId,
            sendingHost,
            tenantName,
            errorName:
              tenantError instanceof Error ? tenantError.name : undefined,
            errorMessage:
              tenantError instanceof Error
                ? tenantError.message
                : String(tenantError),
          },
        );
        tenantName = null;
      }

      const dnsRecords = buildSendingDnsRecords({
        domain,
        sendingHost,
        tokens: identity.tokens,
        region: this.ses.getRegion(),
        mailFromSubdomain: MAIL_FROM_SUBDOMAIN,
      });

      const { data, error } = await fromTable(this.client)
        .insert({
          account_id: input.accountId,
          domain,
          sending_subdomain: sendingSubdomain,
          mail_from_subdomain: MAIL_FROM_SUBDOMAIN,
          default_local_part: localPart,
          ses_identity_name: sendingHost,
          ses_identity_arn: identity.identityArn,
          ses_tenant_name: tenantName,
          ses_configuration_set: configurationSetName,
          dkim_tokens: identity.tokens,
          dns_records: dnsRecords,
          dkim_status: 'pending',
          mail_from_status: 'pending',
          verification_status: 'pending',
          created_by: input.userId,
          instructions_share_token: generateInstructionsShareToken(),
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
    } catch (error) {
      if (identityCreated) {
        try {
          await this.ses.deleteIdentity(sendingHost);
        } catch (cleanupError) {
          console.warn(
            '[sending-domains] Best-effort SES identity cleanup failed after create error',
            {
              sendingHost,
              cleanupError:
                cleanupError instanceof Error
                  ? cleanupError.message
                  : String(cleanupError),
            },
          );
        }
      }

      if (error instanceof SendingDomainError) {
        throw error;
      }

      const mapped = mapSesIdentityAdminError(error);
      throw new SendingDomainError(mapped.message);
    }
  }

  private async assertUnclaimedIdentity(
    accountId: string,
    apex: string,
    sendingHost: string,
  ) {
    await this.assertUnclaimedField(accountId, 'domain', apex, 'domain');

    if (sendingHost !== apex) {
      await this.assertUnclaimedField(
        accountId,
        'domain',
        sendingHost,
        'domain',
      );
    }

    await this.assertUnclaimedField(
      accountId,
      'ses_identity_name',
      sendingHost,
      'host',
    );
    await this.assertUnclaimedField(
      accountId,
      'sending_host',
      sendingHost,
      'host',
      { ignoreMissingColumn: true },
    );
  }

  private async assertUnclaimedField(
    accountId: string,
    field: 'domain' | 'ses_identity_name' | 'sending_host',
    value: string,
    kind: 'domain' | 'host',
    options?: { ignoreMissingColumn?: boolean },
  ) {
    const { data, error } = await fromTable(this.client)
      .select('account_id')
      .eq(field, value)
      .maybeSingle();

    if (error) {
      if (
        options?.ignoreMissingColumn &&
        (isMissingTableError(error) ||
          /sending_host|column/i.test(error.message ?? ''))
      ) {
        return;
      }
      throw new SendingDomainError(error.message);
    }

    if (data && String(data.account_id) !== accountId) {
      throw new SendingDomainError(
        kind === 'domain'
          ? 'That domain is already connected to another workspace.'
          : 'That sending host is already connected to another workspace.',
      );
    }
  }

  async refreshStatus(accountId: string): Promise<SendingDomainRecord | null> {
    const existing = await this.getForAccount(accountId);
    if (!existing) {
      return null;
    }

    const sendingHost =
      existing.ses_identity_name ||
      existing.sending_host ||
      resolveSendingHost(existing.domain, existing.sending_subdomain);
    const snapshot = await this.ses.getDomainIdentity(sendingHost);
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
      sendingHost,
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

    const mapped = mapRow(data as Record<string, unknown>);
    const justVerified =
      !existing.verified_at && mapped.verification_status === 'verified';

    if (justVerified) {
      // Dynamic import keeps this module usable in unit tests without server-only.
      void import('./notify-sending-domain-connected')
        .then(({ notifySendingDomainConnected }) =>
          notifySendingDomainConnected({ domain: mapped }),
        )
        .catch((error) => {
          console.warn('[sending-domains] connected notify failed', {
            accountId: mapped.account_id,
            error: error instanceof Error ? error.message : String(error),
          });
        });
    }

    return mapped;
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

  async removeDomain(
    accountId: string,
  ): Promise<{ sesCleanupFailed?: string }> {
    const existing = await this.getForAccount(accountId);
    if (!existing) {
      return {};
    }

    // Unblock the workspace first. Orphaned SES resources can be cleaned up
    // after; a row that points at a half-deleted tenant cannot.
    const { error } = await fromTable(this.client)
      .delete()
      .eq('id', existing.id);

    if (error) {
      throw new SendingDomainError(error.message);
    }

    try {
      if (existing.ses_tenant_name && existing.ses_identity_arn) {
        await this.ses.disassociateTenantResource(
          existing.ses_tenant_name,
          existing.ses_identity_arn,
        );
      }

      if (existing.ses_tenant_name && existing.ses_configuration_set) {
        try {
          const configArn = (
            await this.ses.ensureConfigurationSet(
              existing.ses_configuration_set,
            )
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

      const identityName =
        existing.ses_identity_name ||
        existing.sending_host ||
        resolveSendingHost(existing.domain, existing.sending_subdomain);

      if (identityName) {
        await this.ses.deleteIdentity(identityName);
      }
    } catch (cleanupError) {
      return {
        sesCleanupFailed:
          cleanupError instanceof Error
            ? cleanupError.message
            : 'Mail provider cleanup failed',
      };
    }

    return {};
  }

  async ensureInstructionsShareToken(accountId: string): Promise<string> {
    const existing = await this.getForAccount(accountId);
    if (!existing) {
      throw new SendingDomainError('Add a sending domain first.');
    }

    if (existing.instructions_share_token) {
      return existing.instructions_share_token;
    }

    const token = generateInstructionsShareToken();
    const { data, error } = await fromTable(this.client)
      .update({ instructions_share_token: token })
      .eq('id', existing.id)
      .select('instructions_share_token')
      .single();

    if (error || !data) {
      throw new SendingDomainError(
        error?.message ?? 'Could not create a share link for DNS instructions.',
      );
    }

    const saved = (data as { instructions_share_token?: string | null })
      .instructions_share_token;
    if (!saved) {
      throw new SendingDomainError(
        'Could not create a share link for DNS instructions.',
      );
    }

    return saved;
  }

  async getPublicInstructionsByToken(
    token: string,
  ): Promise<PublicSendingDomainInstructions | null> {
    return loadPublicSendingDomainInstructions(this.client, token);
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

export async function loadPublicSendingDomainInstructions(
  client: SupabaseClient,
  token: string,
): Promise<PublicSendingDomainInstructions | null> {
  const normalized = token.trim();
  if (!normalized || normalized.length < 16) {
    return null;
  }

  const { data, error } = await fromTable(client)
    .select(
      'domain, sending_subdomain, sending_host, dns_records, verification_status, dkim_status, mail_from_status, account_id',
    )
    .eq('instructions_share_token', normalized)
    .maybeSingle();

  if (error) {
    if (
      isMissingTableError(error) ||
      /instructions_share_token|column/i.test(error.message ?? '')
    ) {
      return null;
    }
    throw new SendingDomainError(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as Record<string, unknown>;
  const domain = String(row.domain);
  const sendingHost =
    typeof row.sending_host === 'string' && row.sending_host.trim()
      ? row.sending_host.trim().toLowerCase()
      : resolveSendingHost(
          domain,
          typeof row.sending_subdomain === 'string'
            ? row.sending_subdomain
            : null,
        );

  const verification = row.verification_status;
  const verificationStatus =
    verification === 'verified' ||
    verification === 'failed' ||
    verification === 'pending'
      ? verification
      : overallVerificationStatus({
          dkim_status: String(row.dkim_status ?? 'pending'),
          mail_from_status: String(row.mail_from_status ?? 'pending'),
        });

  const { data: account, error: accountError } = await client
    .from('accounts')
    .select('name')
    .eq('id', String(row.account_id))
    .maybeSingle();

  if (accountError) {
    throw new SendingDomainError(accountError.message);
  }

  const accountName =
    (account as { name?: string | null } | null)?.name?.trim() || domain;

  return {
    accountName,
    domain,
    sendingHost,
    dnsRecords: asDnsRecords(row.dns_records),
    verificationStatus,
  };
}
