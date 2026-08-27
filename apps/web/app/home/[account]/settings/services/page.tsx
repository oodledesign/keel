import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import type { PlanTemplateRecord } from '~/lib/billing/plan-templates-types';
import type { RequestTypeRecord } from '~/lib/credits/request-types-types';

import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../_lib/role-access';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import {
  WORK_DESIGN_SETTINGS_PROFILES,
  redirectIfProfileNotIn,
} from '../../_lib/server/workspace-route-guard';
import { RequestTypesPanel } from './_components/request-types-panel';
import { ServicesPlansPanel } from './_components/services-plans-panel';
import { createPlanTemplatesService } from './_lib/server/plan-templates.service';
import { createRequestTypesService } from './_lib/server/request-types.service';

export const generateMetadata = async () => ({ title: 'Services' });

interface ServicesSettingsPageProps {
  params: Promise<{ account: string }>;
}

export default async function ServicesSettingsPage(
  props: ServicesSettingsPageProps,
) {
  const { account } = await props.params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfProfileNotIn(workspace, account, WORK_DESIGN_SETTINGS_PROFILES);

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
  const client = getSupabaseServerClient();
  const planService = createPlanTemplatesService(client);
  const requestTypesService = createRequestTypesService(client);

  let templates: PlanTemplateRecord[] = [];
  let requestTypes: RequestTypeRecord[] = [];
  try {
    templates = await planService.listTemplates(accountId);
  } catch {
    templates = [];
  }
  try {
    requestTypes = await requestTypesService.list(accountId);
  } catch {
    requestTypes = [];
  }

  const canEdit = access.isOwner || access.isAdmin;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-10 px-4 py-6 md:px-6">
      <ServicesPlansPanel
        accountId={accountId}
        initialTemplates={templates}
        canEdit={canEdit}
      />
      <RequestTypesPanel
        accountId={accountId}
        initialTypes={requestTypes}
        canEdit={canEdit}
      />
    </div>
  );
}
