import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  getShareByIdForGuest,
  listActiveSharesForGuest,
} from '~/lib/clients/client-workspace-shares.service';
import { DELIVERY_PROJECT_TYPE } from '~/lib/projects/project-types';

export type PartnerSharedProject = {
  id: string;
  name: string;
  status: string | null;
  updatedAt: string | null;
  estimatePence: number;
  actualPence: number;
  pendingApprovalCount: number;
};

/** Project row for the partner workspace Projects board / shared-client list. */
export type PartnerBoardProject = PartnerSharedProject & {
  shareId: string;
  clientName: string | null;
  ownerAccountName: string | null;
};

export type PartnerProjectAccess = {
  shareId: string;
  projectId: string;
  projectName: string;
  projectStatus: string | null;
  ownerAccountId: string;
  ownerAccountName: string | null;
  partnerAccountId: string;
  clientOrgId: string;
  clientName: string | null;
};

/**
 * List host delivery projects for an active can_projects share.
 */
export async function listProjectsForShare(input: {
  guestAccountId: string;
  shareId: string;
}): Promise<PartnerSharedProject[]> {
  const share = await getShareByIdForGuest(input.guestAccountId, input.shareId);
  if (!share || share.status !== 'active' || !share.capabilities.canProjects) {
    return [];
  }

  const admin = getSupabaseServerAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: projects, error } = await (admin as any)
    .from('projects')
    .select(
      'id, name, title, status, updated_at, client_org_id, client_id, project_type, clients(client_org_id)',
    )
    .eq('account_id', share.ownerAccountId)
    .eq('project_type', DELIVERY_PROJECT_TYPE)
    .order('updated_at', { ascending: false });

  if (error) {
    console.warn('[partner-projects] list failed:', error.message);
    return [];
  }

  const rows = (projects ?? []) as Array<Record<string, unknown>>;
  const matched = rows.filter((row) => {
    const client = row.clients as { client_org_id?: string | null } | null;
    const orgId =
      (row.client_org_id as string | null) ?? client?.client_org_id ?? null;
    return orgId === share.clientOrgId;
  });

  const projectIds = matched.map((row) => String(row.id));
  const rollups = await loadCostRollups(projectIds, share.id);

  return matched.map((row) => {
    const id = String(row.id);
    const title = ((row.title as string | null) ?? '').trim();
    const name =
      title || ((row.name as string | null) ?? '').trim() || 'Project';
    const rollup = rollups.get(id) ?? {
      estimatePence: 0,
      actualPence: 0,
      pendingApprovalCount: 0,
    };
    return {
      id,
      name,
      status: (row.status as string | null) ?? null,
      updatedAt: (row.updated_at as string | null) ?? null,
      ...rollup,
    };
  });
}

async function loadCostRollups(
  projectIds: string[],
  shareId: string,
): Promise<
  Map<
    string,
    {
      estimatePence: number;
      actualPence: number;
      pendingApprovalCount: number;
    }
  >
> {
  const map = new Map<
    string,
    {
      estimatePence: number;
      actualPence: number;
      pendingApprovalCount: number;
    }
  >();
  if (projectIds.length === 0) return map;

  const client = getSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('partner_project_cost_lines')
    .select('project_id, estimate_pence, actual_pence, status')
    .eq('share_id', shareId)
    .in('project_id', projectIds);

  if (error) {
    console.warn('[partner-projects] cost rollup failed:', error.message);
    return map;
  }

  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const projectId = String(row.project_id);
    const current = map.get(projectId) ?? {
      estimatePence: 0,
      actualPence: 0,
      pendingApprovalCount: 0,
    };
    current.estimatePence += Number(row.estimate_pence ?? 0);
    current.actualPence += Number(row.actual_pence ?? 0);
    if (row.status === 'submitted') current.pendingApprovalCount += 1;
    map.set(projectId, current);
  }

  return map;
}

/**
 * Assert partner workspace can open a host project via share.
 */
export async function assertPartnerProjectAccess(input: {
  guestAccountId: string;
  shareId: string;
  projectId: string;
}): Promise<PartnerProjectAccess | null> {
  const share = await getShareByIdForGuest(input.guestAccountId, input.shareId);
  if (
    !share ||
    share.status !== 'active' ||
    !share.capabilities.canProjects ||
    !share.guestAccountId
  ) {
    return null;
  }

  const admin = getSupabaseServerAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: project } = await (admin as any)
    .from('projects')
    .select(
      'id, name, title, status, account_id, client_org_id, client_id, project_type, clients(client_org_id)',
    )
    .eq('id', input.projectId)
    .eq('account_id', share.ownerAccountId)
    .maybeSingle();

  if (!project) return null;

  const row = project as Record<string, unknown>;
  if (row.project_type !== DELIVERY_PROJECT_TYPE) return null;

  const client = row.clients as { client_org_id?: string | null } | null;
  const orgId =
    (row.client_org_id as string | null) ?? client?.client_org_id ?? null;
  if (orgId !== share.clientOrgId) return null;

  const title = ((row.title as string | null) ?? '').trim();
  const name = title || ((row.name as string | null) ?? '').trim() || 'Project';

  return {
    shareId: share.id,
    projectId: String(row.id),
    projectName: name,
    projectStatus: (row.status as string | null) ?? null,
    ownerAccountId: share.ownerAccountId,
    ownerAccountName: share.ownerAccountName,
    partnerAccountId: share.guestAccountId,
    clientOrgId: share.clientOrgId,
    clientName: share.clientDisplayName ?? share.clientOrgName,
  };
}

/**
 * All delivery projects across active can_projects shares for a guest workspace.
 */
export async function listPartnerBoardProjectsForGuest(
  guestAccountId: string,
): Promise<PartnerBoardProject[]> {
  const shares = await listActiveSharesForGuest(guestAccountId);
  const projectShares = shares.filter(
    (share) => share.status === 'active' && share.capabilities.canProjects,
  );

  if (projectShares.length === 0) {
    return [];
  }

  const nested = await Promise.all(
    projectShares.map(async (share) => {
      const projects = await listProjectsForShare({
        guestAccountId,
        shareId: share.id,
      });
      return projects.map((project) => ({
        ...project,
        shareId: share.id,
        clientName: share.clientDisplayName ?? share.clientOrgName,
        ownerAccountName: share.ownerAccountName,
      }));
    }),
  );

  return nested
    .flat()
    .sort((a, b) => {
      const aTime = a.updatedAt ? Date.parse(a.updatedAt) : 0;
      const bTime = b.updatedAt ? Date.parse(b.updatedAt) : 0;
      return bTime - aTime;
    });
}
