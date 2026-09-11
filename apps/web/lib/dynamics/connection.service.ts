import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { canEncryptDynamicsSecrets, decryptDynamicsSecret, encryptDynamicsSecret } from './crypto';
import {
  defaultDynamicsFieldMapping,
  normalizeDynamicsEnvironmentUrl,
  normalizeDynamicsFieldMapping,
  validateDynamicsFieldMapping,
} from './field-map';
import type {
  DynamicsConnectionPublic,
  DynamicsConnectionSecrets,
  DynamicsEntity,
  DynamicsFieldMapping,
} from './types';

function fromTable(client: SupabaseClient, table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from(table);
}

export function createDynamicsConnectionService(client: SupabaseClient) {
  return new DynamicsConnectionService(client);
}

class DynamicsConnectionService {
  constructor(private readonly client: SupabaseClient) {}

  async getPublic(accountId: string): Promise<DynamicsConnectionPublic> {
    const { data, error } = await fromTable(
      this.client,
      'workspace_dynamics_connections',
    )
      .select(
        'tenant_id, environment_url, application_id, client_secret_encrypted, sync_enabled, entity, field_mapping, last_tested_at, last_test_error, last_sync_at, last_sync_error',
      )
      .eq('account_id', accountId)
      .maybeSingle();

    if (error) throw new Error(error.message);

    const [pendingJobCount, failedJobCount] = await Promise.all([
      this.countJobs(accountId, ['pending', 'processing']),
      this.countJobs(accountId, ['failed']),
    ]);

    if (!data) {
      return emptyPublic(pendingJobCount, failedJobCount);
    }

    const entity = data.entity === 'lead' ? 'lead' : 'contact';
    return {
      connected: Boolean(data.client_secret_encrypted && data.tenant_id),
      syncEnabled: Boolean(data.sync_enabled),
      tenantId: String(data.tenant_id ?? ''),
      environmentUrl: String(data.environment_url ?? ''),
      applicationId: String(data.application_id ?? ''),
      hasClientSecret: Boolean(data.client_secret_encrypted),
      entity,
      fieldMapping: normalizeDynamicsFieldMapping(data.field_mapping, entity),
      lastTestedAt: (data.last_tested_at as string | null) ?? null,
      lastTestError: (data.last_test_error as string | null) ?? null,
      lastSyncAt: (data.last_sync_at as string | null) ?? null,
      lastSyncError: (data.last_sync_error as string | null) ?? null,
      pendingJobCount,
      failedJobCount,
      canEncryptSecrets: canEncryptDynamicsSecrets(),
    };
  }

  async loadSecrets(
    accountId: string,
  ): Promise<DynamicsConnectionSecrets | null> {
    const { data, error } = await fromTable(
      this.client,
      'workspace_dynamics_connections',
    )
      .select(
        'tenant_id, environment_url, application_id, client_secret_encrypted, sync_enabled, entity, field_mapping',
      )
      .eq('account_id', accountId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data?.client_secret_encrypted || !data.tenant_id) return null;

    const entity: DynamicsEntity = data.entity === 'lead' ? 'lead' : 'contact';
    return {
      tenantId: String(data.tenant_id),
      environmentUrl: String(data.environment_url),
      applicationId: String(data.application_id),
      clientSecret: decryptDynamicsSecret(String(data.client_secret_encrypted)),
      entity,
      fieldMapping: normalizeDynamicsFieldMapping(data.field_mapping, entity),
      syncEnabled: Boolean(data.sync_enabled),
    };
  }

  async save(input: {
    accountId: string;
    userId: string;
    syncEnabled: boolean;
    tenantId: string;
    environmentUrl: string;
    applicationId: string;
    clientSecret?: string | null;
    entity: DynamicsEntity;
    fieldMapping: DynamicsFieldMapping;
  }): Promise<DynamicsConnectionPublic> {
    const environmentUrl = normalizeDynamicsEnvironmentUrl(input.environmentUrl);
    validateDynamicsFieldMapping(input.fieldMapping);

    const existing = await fromTable(
      this.client,
      'workspace_dynamics_connections',
    )
      .select('id, client_secret_encrypted')
      .eq('account_id', input.accountId)
      .maybeSingle();

    if (existing.error) throw new Error(existing.error.message);

    let secretEncrypted =
      (existing.data?.client_secret_encrypted as string | null) ?? null;
    const nextSecret = input.clientSecret?.trim();
    if (nextSecret) {
      secretEncrypted = encryptDynamicsSecret(nextSecret);
    }
    if (!secretEncrypted) {
      throw new Error('Paste the Azure app client secret to connect Dynamics');
    }

    const row = {
      account_id: input.accountId,
      tenant_id: input.tenantId.trim(),
      environment_url: environmentUrl,
      application_id: input.applicationId.trim(),
      client_secret_encrypted: secretEncrypted,
      sync_enabled: input.syncEnabled,
      entity: input.entity,
      field_mapping: input.fieldMapping,
      connected_by: input.userId,
      updated_at: new Date().toISOString(),
    };

    if (existing.data?.id) {
      const { error } = await fromTable(
        this.client,
        'workspace_dynamics_connections',
      )
        .update(row)
        .eq('id', existing.data.id)
        .eq('account_id', input.accountId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await fromTable(
        this.client,
        'workspace_dynamics_connections',
      ).insert({
        ...row,
        created_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
    }

    return this.getPublic(input.accountId);
  }

  async disconnect(accountId: string): Promise<DynamicsConnectionPublic> {
    const { error } = await fromTable(
      this.client,
      'workspace_dynamics_connections',
    )
      .delete()
      .eq('account_id', accountId);
    if (error) throw new Error(error.message);
    return this.getPublic(accountId);
  }

  async recordTest(
    accountId: string,
    result: { ok: boolean; error?: string | null },
  ) {
    const { error } = await fromTable(
      this.client,
      'workspace_dynamics_connections',
    )
      .update({
        last_tested_at: new Date().toISOString(),
        last_test_error: result.ok ? null : (result.error ?? 'Test failed'),
        updated_at: new Date().toISOString(),
      })
      .eq('account_id', accountId);
    if (error) throw new Error(error.message);
  }

  async recordSync(
    accountId: string,
    result: { ok: boolean; error?: string | null },
  ) {
    const { error } = await fromTable(
      this.client,
      'workspace_dynamics_connections',
    )
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_error: result.ok ? null : (result.error ?? 'Sync failed'),
        updated_at: new Date().toISOString(),
      })
      .eq('account_id', accountId);
    if (error) throw new Error(error.message);
  }

  private async countJobs(
    accountId: string,
    statuses: string[],
  ): Promise<number> {
    const { count, error } = await fromTable(
      this.client,
      'workspace_dynamics_sync_jobs',
    )
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .in('status', statuses);

    if (error) return 0;
    return count ?? 0;
  }
}

function emptyPublic(
  pendingJobCount: number,
  failedJobCount: number,
): DynamicsConnectionPublic {
  return {
    connected: false,
    syncEnabled: false,
    tenantId: '',
    environmentUrl: '',
    applicationId: '',
    hasClientSecret: false,
    entity: 'contact',
    fieldMapping: defaultDynamicsFieldMapping('contact'),
    lastTestedAt: null,
    lastTestError: null,
    lastSyncAt: null,
    lastSyncError: null,
    pendingJobCount,
    failedJobCount,
    canEncryptSecrets: canEncryptDynamicsSecrets(),
  };
}
