import 'server-only';

import { redirect } from 'next/navigation';

import pathsConfig from '~/config/paths.config';

import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import {
  notesVariantFromProfile,
  resolveWorkspaceProfile,
} from '../../../_lib/server/workspace-profile';
import {
  BUSINESS_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../../_lib/server/workspace-route-guard';
import {
  loadAccountDocById,
  loadAccountDocs,
} from '../../../_lib/workspace-content/docs-loader';
import {
  linkOptionsForProfile,
  loadWorkspaceLinkOptions,
} from '../../../_lib/workspace-content/link-options.loader';
import type { DocListItem } from '../../../_lib/workspace-content/types';

export type WorkDocListItem = DocListItem;

export async function loadDocsPageData(accountSlug: string) {
  const workspace = await loadTeamWorkspace(accountSlug);

  if (!workspace?.account) {
    redirect(pathsConfig.app.home);
  }

  redirectIfSpaceNotIn(workspace, accountSlug, BUSINESS_WORKSPACE_SPACE_TYPES);

  const accountId = workspace.account.id as string;
  const profile = resolveWorkspaceProfile({
    space_type: (workspace.account as { space_type?: string }).space_type,
    business_type: workspace.businessType,
  });

  const [{ docs, tableAvailable }, linkOpts] = await Promise.all([
    loadAccountDocs(accountId),
    loadWorkspaceLinkOptions(accountId, profile),
  ]);

  const docTypes = [
    ...new Set(docs.map((d) => d.docType).filter(Boolean) as string[]),
  ].sort();

  return {
    accountId,
    accountSlug: workspace.account.slug ?? accountSlug,
    docs,
    docTypes,
    tableAvailable,
    variant: notesVariantFromProfile(profile),
    linkOptions: linkOptionsForProfile(linkOpts, profile),
  };
}

export async function loadDocDetailData(accountSlug: string, docId: string) {
  const workspace = await loadTeamWorkspace(accountSlug);

  if (!workspace?.account) {
    redirect(pathsConfig.app.home);
  }

  redirectIfSpaceNotIn(workspace, accountSlug, BUSINESS_WORKSPACE_SPACE_TYPES);

  const accountId = workspace.account.id as string;
  const doc = await loadAccountDocById(accountId, docId);

  if (!doc) {
    redirect(pathsConfig.app.accountDocs.replace('[account]', accountSlug));
  }

  return {
    accountId,
    accountSlug: workspace.account.slug ?? accountSlug,
    doc: {
      id: doc.id,
      title: doc.title,
      kind: doc.kind,
      docType: doc.docType,
      content: doc.content,
      projectName:
        doc.context?.type === 'job' || doc.context?.type === 'project'
          ? doc.context.label
          : null,
      clientName: doc.context?.type === 'client' ? doc.context.label : null,
      propertyName: doc.context?.type === 'property' ? doc.context.label : null,
    },
  };
}
