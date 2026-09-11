import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getLogger } from '@kit/shared/logger';

import { createDynamicsConnectionService } from './connection.service';
import { createDataverseClient } from './dataverse-client';
import { splitPersonName } from './field-map';
import type { DynamicsSyncJob, DynamicsSyncJobPayload } from './types';

const MAX_ATTEMPTS = 8;
const BACKOFF_SECONDS = [60, 300, 900, 3600, 21600, 86400];

function fromTable(client: SupabaseClient, table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from(table);
}

function nextRetryAt(attempts: number): string {
  const seconds =
    BACKOFF_SECONDS[Math.min(attempts - 1, BACKOFF_SECONDS.length - 1)] ??
    86400;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function mapJob(row: Record<string, unknown>): DynamicsSyncJob {
  const payload = (row.payload ?? {}) as Partial<DynamicsSyncJobPayload>;
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    preferenceId: (row.preference_id as string | null) ?? null,
    clientId: (row.client_id as string | null) ?? null,
    email: String(row.email),
    payload: {
      firstName: String(payload.firstName ?? 'Contact'),
      lastName: (payload.lastName as string | null) ?? null,
      companyName: (payload.companyName as string | null) ?? null,
      marketingOptedIn: Boolean(payload.marketingOptedIn),
    },
    status: row.status as DynamicsSyncJob['status'],
    attempts: Number(row.attempts ?? 0),
    lastError: (row.last_error as string | null) ?? null,
    nextRetryAt: (row.next_retry_at as string | null) ?? null,
    dynamicsRecordId: (row.dynamics_record_id as string | null) ?? null,
    createdAt: String(row.created_at),
  };
}

export async function scheduleDynamicsMailingListSync(input: {
  client: SupabaseClient;
  accountId: string;
  email: string;
  preferenceId?: string | null;
  clientId?: string | null;
  contactName?: string | null;
  companyName?: string | null;
  marketingOptedIn: boolean;
}): Promise<{ enqueued: boolean; reason?: string }> {
  const logger = await getLogger();
  const connections = createDynamicsConnectionService(input.client);

  let secrets;
  try {
    secrets = await connections.loadSecrets(input.accountId);
  } catch (error) {
    logger.warn(
      {
        name: 'dynamics.enqueue',
        accountId: input.accountId,
        error: error instanceof Error ? error.message : String(error),
      },
      'Could not load Dynamics connection',
    );
    return { enqueued: false, reason: 'load_failed' };
  }

  if (!secrets) {
    return { enqueued: false, reason: 'not_connected' };
  }
  if (!secrets.syncEnabled) {
    return { enqueued: false, reason: 'sync_disabled' };
  }

  const names = splitPersonName(input.contactName?.trim() || input.email);
  const payload: DynamicsSyncJobPayload = {
    firstName: names.firstName,
    lastName: names.lastName,
    companyName: input.companyName?.trim() || null,
    marketingOptedIn: input.marketingOptedIn,
  };

  const { error } = await fromTable(
    input.client,
    'workspace_dynamics_sync_jobs',
  ).insert({
    account_id: input.accountId,
    preference_id: input.preferenceId ?? null,
    client_id: input.clientId ?? null,
    email: input.email,
    payload,
    status: 'pending',
    attempts: 0,
    next_retry_at: new Date().toISOString(),
  });

  if (error) {
    logger.warn(
      {
        name: 'dynamics.enqueue',
        accountId: input.accountId,
        error: error.message,
      },
      'Could not enqueue Dynamics contact sync',
    );
    return { enqueued: false, reason: 'insert_failed' };
  }

  return { enqueued: true };
}

export async function processDueDynamicsSyncJobs(
  client: SupabaseClient,
  options?: { accountId?: string; limit?: number },
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const logger = await getLogger();
  const limit = options?.limit ?? 25;
  let query = fromTable(client, 'workspace_dynamics_sync_jobs')
    .select('*')
    .in('status', ['pending', 'failed'])
    .lte('next_retry_at', new Date().toISOString())
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (options?.accountId) {
    query = query.eq('account_id', options.accountId);
  }

  const { data, error } = await query;
  if (error) {
    logger.warn(
      { name: 'dynamics.sync', error: error.message },
      'Could not load Dynamics sync jobs',
    );
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  const jobs = ((data ?? []) as Array<Record<string, unknown>>).map(mapJob);
  let succeeded = 0;
  let failed = 0;

  for (const job of jobs) {
    const claimed = await fromTable(client, 'workspace_dynamics_sync_jobs')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)
      .in('status', ['pending', 'failed'])
      .select('id')
      .maybeSingle();

    if (claimed.error || !claimed.data) continue;

    const result = await processOneJob(client, job);
    if (result === 'succeeded') succeeded += 1;
    else failed += 1;
  }

  return { processed: succeeded + failed, succeeded, failed };
}

async function processOneJob(
  client: SupabaseClient,
  job: DynamicsSyncJob,
): Promise<'succeeded' | 'failed'> {
  const logger = await getLogger();
  const connections = createDynamicsConnectionService(client);
  const attempts = job.attempts + 1;

  try {
    const secrets = await connections.loadSecrets(job.accountId);
    if (!secrets?.syncEnabled) {
      throw new Error('Dynamics sync is disabled or not connected');
    }

    const dataverse = createDataverseClient({
      tenantId: secrets.tenantId,
      environmentUrl: secrets.environmentUrl,
      applicationId: secrets.applicationId,
      clientSecret: secrets.clientSecret,
    });

    const upsert = await dataverse.upsertSubscriber({
      entity: secrets.entity,
      mapping: secrets.fieldMapping,
      subscriber: {
        email: job.email,
        firstName: job.payload.firstName,
        lastName: job.payload.lastName,
        companyName: job.payload.companyName,
        marketingOptedIn: job.payload.marketingOptedIn,
      },
    });

    const { error } = await fromTable(client, 'workspace_dynamics_sync_jobs')
      .update({
        status: 'succeeded',
        attempts,
        last_error: null,
        next_retry_at: null,
        dynamics_record_id: upsert.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    if (error) throw new Error(error.message);

    await connections.recordSync(job.accountId, { ok: true });
    return 'succeeded';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const terminal = attempts >= MAX_ATTEMPTS;
    logger.warn(
      {
        name: 'dynamics.sync',
        accountId: job.accountId,
        jobId: job.id,
        attempts,
        error: message,
      },
      'Dynamics contact upsert failed',
    );

    await fromTable(client, 'workspace_dynamics_sync_jobs')
      .update({
        status: 'failed',
        attempts,
        last_error: message.slice(0, 1000),
        next_retry_at: terminal ? null : nextRetryAt(attempts),
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    await connections.recordSync(job.accountId, { ok: false, error: message });
    return 'failed';
  }
}

export async function retryFailedDynamicsSyncJobs(
  client: SupabaseClient,
  accountId: string,
): Promise<number> {
  const { data, error } = await fromTable(
    client,
    'workspace_dynamics_sync_jobs',
  )
    .update({
      status: 'pending',
      next_retry_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('account_id', accountId)
    .eq('status', 'failed')
    .select('id');

  if (error) throw new Error(error.message);
  return (data ?? []).length;
}

export { MAX_ATTEMPTS as DYNAMICS_SYNC_MAX_ATTEMPTS };
