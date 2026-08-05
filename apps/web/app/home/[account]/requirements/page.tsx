import { redirect } from 'next/navigation';

import pathsConfig from '~/config/paths.config';
import { withI18n } from '~/lib/i18n/with-i18n';

import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import {
  COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../_lib/server/workspace-route-guard';

interface RequirementsPageProps {
  params: Promise<{ account: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const generateMetadata = async () => ({ title: 'Requirements' });

async function RequirementsPage({
  params,
  searchParams,
}: RequirementsPageProps) {
  const { account: slug } = await params;
  const workspace = await loadTeamWorkspace(slug);
  redirectIfSpaceNotIn(
    workspace,
    slug,
    COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  );

  const query = await searchParams;
  const create = query.create;
  const createFlag = Array.isArray(create) ? create[0] : create;

  const pipelinePath = pathsConfig.app.accountPipeline.replace(
    '[account]',
    slug,
  );
  const paramsOut = new URLSearchParams({ view: 'requirements' });
  if (createFlag === '1' || createFlag === 'lead') {
    paramsOut.set('create', '1');
  }

  redirect(`${pipelinePath}?${paramsOut.toString()}`);
}

export default withI18n(RequirementsPage);
