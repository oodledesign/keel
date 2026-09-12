import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';

import {
  adjustProjectRetainerCredits,
  ensureProjectRetainer,
} from '~/lib/retainers/credit-ledger';
import {
  mapProjectRetainer,
  mapRetainerBurn,
  mapRetainerService,
} from '~/lib/retainers/map-records';
import type {
  ProjectRetainerBurn,
  ProjectRetainerRecord,
  RetainerServiceRecord,
} from '~/lib/retainers/types';

function db(client: SupabaseClient) {
  return client as any;
}

export function createProjectRetainerService(client: SupabaseClient) {
  return new ProjectRetainerService(client);
}

class ProjectRetainerService {
  constructor(private readonly client: SupabaseClient) {}

  private async ensureMember(accountId: string) {
    const auth = await requireUser(this.client);
    if (!auth.data) throw new Error('Unauthorised');
    const { data: membership } = await this.client
      .from('accounts_memberships')
      .select('account_role')
      .eq('account_id', accountId)
      .eq('user_id', auth.data.id)
      .maybeSingle();
    const role = membership?.account_role as string | undefined;
    if (!role || role === 'client' || role === 'contractor') {
      throw new Error('Forbidden');
    }
    return { userId: auth.data.id };
  }

  async load(accountId: string, projectId: string): Promise<{
    retainer: ProjectRetainerRecord;
    catalogue: RetainerServiceRecord[];
    recent: ProjectRetainerBurn[];
  }> {
    await this.ensureMember(accountId);
    await ensureProjectRetainer({ projectId, accountId });

    const [retainerRes, allowRes, catalogueRes, txRes] = await Promise.all([
      db(this.client)
        .from('project_retainers')
        .select('*')
        .eq('project_id', projectId)
        .eq('account_id', accountId)
        .maybeSingle(),
      db(this.client)
        .from('project_retainer_services')
        .select('service_id')
        .eq('project_id', projectId),
      db(this.client)
        .from('retainer_services')
        .select('*')
        .eq('account_id', accountId)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true }),
      db(this.client)
        .from('project_retainer_transactions')
        .select('id, amount, service_id, task_id, created_at, type')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(12),
    ]);

    if (retainerRes.error) throw retainerRes.error;
    if (!retainerRes.data) throw new Error('Could not load project retainer');

    const allowedServiceIds = (
      (allowRes.data ?? []) as Array<{ service_id: string }>
    ).map((row) => row.service_id);

    const catalogue = ((catalogueRes.data ?? []) as Array<Record<string, unknown>>)
      .map(mapRetainerService);

    const serviceNames = new Map(catalogue.map((row) => [row.id, row.name]));
    const taskIds = [
      ...new Set(
        ((txRes.data ?? []) as Array<{ task_id: string | null }>)
          .map((row) => row.task_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const taskTitles = new Map<string, string>();
    if (taskIds.length > 0) {
      const { data: tasks } = await this.client
        .from('tasks')
        .select('id, title')
        .in('id', taskIds);
      for (const task of tasks ?? []) {
        taskTitles.set(String(task.id), String(task.title ?? 'Task'));
      }
    }

    const recent = ((txRes.data ?? []) as Array<Record<string, unknown>>).map(
      (row) =>
        mapRetainerBurn({
          ...row,
          service_name: row.service_id
            ? serviceNames.get(String(row.service_id)) ?? null
            : null,
          task_title: row.task_id
            ? taskTitles.get(String(row.task_id)) ?? null
            : null,
        }),
    );

    return {
      retainer: mapProjectRetainer(
        retainerRes.data as Record<string, unknown>,
        allowedServiceIds,
      ),
      catalogue,
      recent,
    };
  }

  async updateSettings(input: {
    accountId: string;
    projectId: string;
    autoMatchEnabled?: boolean;
    weeklyDigestEnabled?: boolean;
    allowedServiceIds?: string[];
  }) {
    const { userId } = await this.ensureMember(input.accountId);
    void userId;
    await ensureProjectRetainer({
      projectId: input.projectId,
      accountId: input.accountId,
    });

    const patch: Record<string, unknown> = {};
    if (input.autoMatchEnabled !== undefined) {
      patch.auto_match_enabled = input.autoMatchEnabled;
    }
    if (input.weeklyDigestEnabled !== undefined) {
      patch.weekly_digest_enabled = input.weeklyDigestEnabled;
    }

    if (Object.keys(patch).length > 0) {
      const { error } = await db(this.client)
        .from('project_retainers')
        .update(patch)
        .eq('project_id', input.projectId)
        .eq('account_id', input.accountId);
      if (error) throw error;
    }

    if (input.allowedServiceIds) {
      const { error: delError } = await db(this.client)
        .from('project_retainer_services')
        .delete()
        .eq('project_id', input.projectId);
      if (delError) throw delError;

      if (input.allowedServiceIds.length > 0) {
        const { error: insError } = await db(this.client)
          .from('project_retainer_services')
          .insert(
            input.allowedServiceIds.map((serviceId) => ({
              project_id: input.projectId,
              service_id: serviceId,
            })),
          );
        if (insError) throw insError;
      }
    }

    return this.load(input.accountId, input.projectId);
  }

  async adjustBalance(input: {
    accountId: string;
    projectId: string;
    delta: number;
    reason?: string;
  }) {
    const { userId } = await this.ensureMember(input.accountId);
    const result = await adjustProjectRetainerCredits({
      projectId: input.projectId,
      accountId: input.accountId,
      delta: input.delta,
      actorId: userId,
      reason: input.reason ?? 'manual_adjustment',
    });
    if (!result.ok) {
      throw new Error(
        result.error === 'insufficient_balance'
          ? 'Balance cannot go below zero'
          : result.error ?? 'Could not update balance',
      );
    }
    return this.load(input.accountId, input.projectId);
  }
}
