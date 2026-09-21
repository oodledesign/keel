import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';

import { createPlanTemplatesService } from '~/home/[account]/settings/services/_lib/server/plan-templates.service';
import {
  type ClientProjectRetainerSummary,
  type ClientRetainerProjectChoice,
  type UnassignedClientRetainer,
  buildClientRetainerSummary,
} from '~/lib/retainers/client-retainer-summary';
import { RETAINER_WORKSPACE_ROLES } from '~/lib/retainers/constants';
import { looseClient } from '~/lib/retainers/loose-client';

export function createClientRetainerSummaryService(client: SupabaseClient) {
  return new ClientRetainerSummaryService(client);
}

class ClientRetainerSummaryService {
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
    if (!role || !RETAINER_WORKSPACE_ROLES.has(role)) {
      throw new Error('Forbidden');
    }
  }

  async list(
    accountId: string,
    clientId: string,
  ): Promise<{
    projects: ClientProjectRetainerSummary[];
    unassigned: UnassignedClientRetainer[];
    choices: ClientRetainerProjectChoice[];
  }> {
    await this.ensureMember(accountId);

    const { data: clientRow } = await this.client
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('account_id', accountId)
      .maybeSingle();
    if (!clientRow) throw new Error('Client not found');

    const [{ data: projectRows }, subscriptions] = await Promise.all([
      this.client
        .from('projects')
        .select('id, title, name, status')
        .eq('account_id', accountId)
        .eq('client_id', clientId)
        .order('updated_at', { ascending: false }),
      createPlanTemplatesService(this.client).listSubscriptions(accountId, {
        clientId,
      }),
    ]);

    const projects = (
      (projectRows ?? []) as Array<{
        id: string;
        title?: string | null;
        name?: string | null;
        status?: string | null;
      }>
    ).map((row) => ({
      id: String(row.id),
      title: String(row.title ?? row.name ?? 'Project').trim() || 'Project',
      status: String(row.status ?? 'active'),
    }));

    const projectIds = projects.map((row) => row.id);
    const balances = new Map<string, number>();

    if (projectIds.length > 0) {
      const { data: retainerRows } = await looseClient(this.client)
        .from('project_retainers')
        .select('project_id, credit_balance')
        .eq('account_id', accountId)
        .in('project_id', projectIds);

      for (const row of (retainerRows ?? []) as Array<{
        project_id?: string;
        credit_balance?: number;
      }>) {
        if (!row.project_id) continue;
        const balance = Number(row.credit_balance ?? 0);
        if (Number.isFinite(balance) && balance > 0) {
          balances.set(String(row.project_id), balance);
        }
      }
    }

    return buildClientRetainerSummary({
      projects,
      balances,
      subscriptions,
    });
  }
}
