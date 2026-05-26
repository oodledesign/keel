import 'server-only';

import {
  linkOptionsForProfile,
  loadWorkspaceLinkOptions,
} from './link-options.loader';
import { loadAccountDocs } from './docs-loader';
import { loadAccountNotes } from './notes-loader';
import {
  resolveWorkspaceProfile,
  type WorkspaceProfile,
} from '../workspace-profile';

export async function loadContextWorkspaceContent(input: {
  accountId: string;
  spaceType?: string | null;
  businessType?: string | null;
  scope:
    | { jobId: string }
    | { projectId: string }
    | { clientOrgId: string }
    | { propertyId: string };
}) {
  const profile = resolveWorkspaceProfile({
    space_type: input.spaceType,
    business_type: input.businessType,
  });

  const scope =
    'jobId' in input.scope
      ? { jobId: input.scope.jobId }
      : 'projectId' in input.scope
        ? { projectId: input.scope.projectId }
        : 'clientOrgId' in input.scope
          ? { clientOrgId: input.scope.clientOrgId }
          : { propertyId: input.scope.propertyId };

  const [notesResult, docsResult, linkOpts] = await Promise.all([
    loadAccountNotes(input.accountId, scope),
    loadAccountDocs(input.accountId, scope),
    loadWorkspaceLinkOptions(input.accountId, profile),
  ]);

  const defaultLink =
    'jobId' in input.scope
      ? ({ type: 'job' as const, id: input.scope.jobId })
      : 'projectId' in input.scope
        ? ({ type: 'project' as const, id: input.scope.projectId })
        : 'clientOrgId' in input.scope
          ? ({ type: 'client' as const, id: input.scope.clientOrgId })
          : ({ type: 'property' as const, id: input.scope.propertyId });

  return {
    profile,
    notes: notesResult.notes,
    docs: docsResult.docs,
    notesTableAvailable: notesResult.tableAvailable,
    docsTableAvailable: docsResult.tableAvailable,
    linkOptions: linkOptionsForProfile(linkOpts, profile),
    defaultLink,
  };
}

export type ContextWorkspaceContent = Awaited<
  ReturnType<typeof loadContextWorkspaceContent>
>;
