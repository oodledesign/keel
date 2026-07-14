import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import type { PlanTemplateRecord } from '~/lib/billing/plan-templates-types';

import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../_lib/role-access';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import {
  BUSINESS_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../_lib/server/workspace-route-guard';
import { ServicesPlansPanel } from './_components/services-plans-panel';
import { createPlanTemplatesService } from './_lib/server/plan-templates.service';

export const generateMetadata = async () => ({ title: 'Services' });

interface ServicesSettingsPageProps {
  params: Promise<{ account: string }>;
}

export default async function ServicesSettingsPage(
  props: ServicesSettingsPageProps,
) {
  const { account } = await props.params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, BUSINESS_WORKSPACE_SPACE_TYPES);

  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (!access.canViewSettings) {
    redirect(
      getDefaultAccountPath(
        account,
        workspace.account as {
          permissions?: string[] | null;
          role?: string | null;
          company_role?: string | null;
        },
      ),
    );
  }

  const accountId = workspace.account.id as string;
  const service = createPlanTemplatesService(getSupabaseServerClient());
  let templates: PlanTemplateRecord[] = [];
  try {
    templates = await service.listTemplates(accountId);
  } catch {
    templates = [];
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 md:px-6">
      <ServicesPlansPanel
        accountId={accountId}
        initialTemplates={templates}
        canEdit={access.isOwner || access.isAdmin}
      />
    </div>
  );
}
