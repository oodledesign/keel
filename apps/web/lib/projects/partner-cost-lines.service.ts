import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { getShareByIdForGuest } from '~/lib/clients/client-workspace-shares.service';
import { DELIVERY_PROJECT_TYPE } from '~/lib/projects/project-types';

export type PartnerCostLineStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected';

export type PartnerCostLine = {
  id: string;
  projectId: string;
  ownerAccountId: string;
  partnerAccountId: string;
  shareId: string;
  title: string;
  description: string | null;
  estimatePence: number | null;
  actualPence: number | null;
  status: PartnerCostLineStatus;
  createdBy: string | null;
  updatedBy: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  partnerAccountName?: string | null;
};

function mapLine(
  row: Record<string, unknown>,
  extras: Partial<PartnerCostLine> = {},
): PartnerCostLine {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    ownerAccountId: String(row.owner_account_id),
    partnerAccountId: String(row.partner_account_id),
    shareId: String(row.share_id),
    title: String(row.title ?? ''),
    description: (row.description as string | null) ?? null,
    estimatePence:
      row.estimate_pence == null ? null : Number(row.estimate_pence),
    actualPence: row.actual_pence == null ? null : Number(row.actual_pence),
    status: row.status as PartnerCostLineStatus,
    createdBy: (row.created_by as string | null) ?? null,
    updatedBy: (row.updated_by as string | null) ?? null,
    reviewedBy: (row.reviewed_by as string | null) ?? null,
    reviewedAt: (row.reviewed_at as string | null) ?? null,
    reviewNote: (row.review_note as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    ...extras,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function costLinesTable(client: { from: (table: string) => any }) {
  return client.from('partner_project_cost_lines');
}

async function resolveProjectShareContext(input: {
  projectId: string;
  shareId: string;
  partnerAccountId: string;
}) {
  const share = await getShareByIdForGuest(
    input.partnerAccountId,
    input.shareId,
  );
  if (
    !share ||
    share.status !== 'active' ||
    !share.capabilities.canProjects ||
    !share.guestAccountId
  ) {
    throw new Error('Share not available for projects');
  }

  const admin = getSupabaseServerAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: project } = await (admin as any)
    .from('projects')
    .select(
      'id, account_id, client_org_id, client_id, project_type, clients(client_org_id)',
    )
    .eq('id', input.projectId)
    .eq('account_id', share.ownerAccountId)
    .maybeSingle();

  if (!project) throw new Error('Project not found');
  const row = project as Record<string, unknown>;
  if (row.project_type !== DELIVERY_PROJECT_TYPE) {
    throw new Error('Project not available');
  }
  const client = row.clients as { client_org_id?: string | null } | null;
  const orgId =
    (row.client_org_id as string | null) ?? client?.client_org_id ?? null;
  if (orgId !== share.clientOrgId) throw new Error('Project not on this share');

  return {
    share,
    ownerAccountId: share.ownerAccountId,
    partnerAccountId: share.guestAccountId!,
  };
}

export function createPartnerCostLinesService(client: SupabaseClient) {
  return {
    async listForPartner(input: {
      shareId: string;
      projectId: string;
      partnerAccountId: string;
    }): Promise<PartnerCostLine[]> {
      await resolveProjectShareContext(input);
      const { data, error } = await costLinesTable(client)
        .select('*')
        .eq('share_id', input.shareId)
        .eq('project_id', input.projectId)
        .order('created_at', { ascending: true });

      if (error) throw new Error(error.message);
      return ((data ?? []) as Array<Record<string, unknown>>).map((row) =>
        mapLine(row),
      );
    },

    async listForHost(input: {
      ownerAccountId: string;
      projectId: string;
    }): Promise<PartnerCostLine[]> {
      const { data, error } = await costLinesTable(client)
        .select('*')
        .eq('owner_account_id', input.ownerAccountId)
        .eq('project_id', input.projectId)
        .order('created_at', { ascending: true });

      if (error) throw new Error(error.message);

      const rows = (data ?? []) as Array<Record<string, unknown>>;
      if (rows.length === 0) return [];

      const partnerIds = [
        ...new Set(rows.map((r) => String(r.partner_account_id))),
      ];
      const admin = getSupabaseServerAdminClient();
      const { data: accounts } = await admin
        .from('accounts')
        .select('id, name')
        .in('id', partnerIds);
      const nameById = new Map(
        ((accounts ?? []) as Array<{ id: string; name: string | null }>).map(
          (a) => [a.id, a.name],
        ),
      );

      return rows.map((row) =>
        mapLine(row, {
          partnerAccountName:
            nameById.get(String(row.partner_account_id)) ?? null,
        }),
      );
    },

    async create(input: {
      shareId: string;
      projectId: string;
      partnerAccountId: string;
      userId: string;
      title: string;
      description?: string | null;
      estimatePence?: number | null;
      actualPence?: number | null;
    }): Promise<PartnerCostLine> {
      const ctx = await resolveProjectShareContext(input);
      const title = input.title.trim();
      if (!title) throw new Error('Title is required');

      const { data, error } = await costLinesTable(client)
        .insert({
          project_id: input.projectId,
          owner_account_id: ctx.ownerAccountId,
          partner_account_id: ctx.partnerAccountId,
          share_id: input.shareId,
          title,
          description: input.description?.trim() || null,
          estimate_pence: input.estimatePence ?? null,
          actual_pence: input.actualPence ?? null,
          status: 'draft',
          created_by: input.userId,
          updated_by: input.userId,
        })
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return mapLine(data as Record<string, unknown>);
    },

    async update(input: {
      lineId: string;
      partnerAccountId: string;
      userId: string;
      title?: string;
      description?: string | null;
      estimatePence?: number | null;
      actualPence?: number | null;
    }): Promise<PartnerCostLine> {
      const { data: existing, error: loadError } = await costLinesTable(client)
        .select('*')
        .eq('id', input.lineId)
        .eq('partner_account_id', input.partnerAccountId)
        .maybeSingle();

      if (loadError) throw new Error(loadError.message);
      if (!existing) throw new Error('Cost line not found');
      const row = existing as Record<string, unknown>;
      if (row.status !== 'draft' && row.status !== 'rejected') {
        throw new Error('Only draft or rejected lines can be edited');
      }

      const patch: Record<string, unknown> = {
        updated_by: input.userId,
      };
      if (input.title !== undefined) {
        const title = input.title.trim();
        if (!title) throw new Error('Title is required');
        patch.title = title;
      }
      if (input.description !== undefined) {
        patch.description = input.description?.trim() || null;
      }
      if (input.estimatePence !== undefined) {
        patch.estimate_pence = input.estimatePence;
      }
      if (input.actualPence !== undefined) {
        patch.actual_pence = input.actualPence;
      }
      if (row.status === 'rejected') {
        patch.status = 'draft';
        patch.reviewed_by = null;
        patch.reviewed_at = null;
        patch.review_note = null;
      }

      const { data, error } = await costLinesTable(client)
        .update(patch)
        .eq('id', input.lineId)
        .eq('partner_account_id', input.partnerAccountId)
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return mapLine(data as Record<string, unknown>);
    },

    async delete(input: {
      lineId: string;
      partnerAccountId: string;
    }): Promise<void> {
      const { data: existing, error: loadError } = await costLinesTable(client)
        .select('id, status')
        .eq('id', input.lineId)
        .eq('partner_account_id', input.partnerAccountId)
        .maybeSingle();

      if (loadError) throw new Error(loadError.message);
      if (!existing) throw new Error('Cost line not found');
      const status = (existing as { status: string }).status;
      if (status !== 'draft' && status !== 'rejected') {
        throw new Error('Only draft or rejected lines can be deleted');
      }

      const { error } = await costLinesTable(client)
        .delete()
        .eq('id', input.lineId)
        .eq('partner_account_id', input.partnerAccountId);

      if (error) throw new Error(error.message);
    },

    async submit(input: {
      lineId: string;
      partnerAccountId: string;
      userId: string;
    }): Promise<PartnerCostLine> {
      const { data: existing, error: loadError } = await costLinesTable(client)
        .select('*')
        .eq('id', input.lineId)
        .eq('partner_account_id', input.partnerAccountId)
        .maybeSingle();

      if (loadError) throw new Error(loadError.message);
      if (!existing) throw new Error('Cost line not found');
      const row = existing as Record<string, unknown>;
      if (row.status !== 'draft' && row.status !== 'rejected') {
        throw new Error('Only draft or rejected lines can be submitted');
      }

      const { data, error } = await costLinesTable(client)
        .update({
          status: 'submitted',
          updated_by: input.userId,
          reviewed_by: null,
          reviewed_at: null,
          review_note: null,
        })
        .eq('id', input.lineId)
        .eq('partner_account_id', input.partnerAccountId)
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return mapLine(data as Record<string, unknown>);
    },

    async review(input: {
      lineId: string;
      ownerAccountId: string;
      userId: string;
      status: 'approved' | 'rejected';
      reviewNote?: string | null;
    }): Promise<PartnerCostLine> {
      const { data: existing, error: loadError } = await costLinesTable(client)
        .select('*')
        .eq('id', input.lineId)
        .eq('owner_account_id', input.ownerAccountId)
        .maybeSingle();

      if (loadError) throw new Error(loadError.message);
      if (!existing) throw new Error('Cost line not found');
      const row = existing as Record<string, unknown>;
      if (row.status !== 'submitted') {
        throw new Error('Only submitted lines can be reviewed');
      }

      const { data, error } = await costLinesTable(client)
        .update({
          status: input.status,
          reviewed_by: input.userId,
          reviewed_at: new Date().toISOString(),
          review_note: input.reviewNote?.trim() || null,
          updated_by: input.userId,
        })
        .eq('id', input.lineId)
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return mapLine(data as Record<string, unknown>);
    },
  };
}

/** Whether the host project has any active can_projects share for its client org. */
export async function projectHasPartnerCostShares(input: {
  ownerAccountId: string;
  projectId: string;
}): Promise<boolean> {
  const admin = getSupabaseServerAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: project } = await (admin as any)
    .from('projects')
    .select('id, client_org_id, client_id, clients(client_org_id)')
    .eq('id', input.projectId)
    .eq('account_id', input.ownerAccountId)
    .maybeSingle();

  if (!project) return false;
  const row = project as Record<string, unknown>;
  const client = row.clients as { client_org_id?: string | null } | null;
  const orgId =
    (row.client_org_id as string | null) ?? client?.client_org_id ?? null;
  if (!orgId) return false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shares } = await (admin as any)
    .from('client_workspace_shares')
    .select('id')
    .eq('owner_account_id', input.ownerAccountId)
    .eq('client_org_id', orgId)
    .eq('status', 'active')
    .eq('can_projects', true)
    .limit(1);

  return ((shares ?? []) as unknown[]).length > 0;
}
