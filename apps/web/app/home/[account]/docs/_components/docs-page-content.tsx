'use client';

import type { DocListItem, LinkOption, WorkspaceDocsVariant } from '../../_lib/workspace-content/types';
import { WorkspaceDocsPage } from '../../_components/workspace-content/workspace-docs-page';

export type { DocListItem as WorkDocListItem };

export function DocsPageContent({
  accountId,
  accountSlug,
  docs,
  tableAvailable,
  linkOptions,
}: {
  accountSlug: string;
  docs: DocListItem[];
  docTypes: string[];
  tableAvailable: boolean;
  accountId: string;
  linkOptions: LinkOption[];
  variant?: WorkspaceDocsVariant;
}) {
  return (
    <WorkspaceDocsPage
      accountId={accountId}
      accountSlug={accountSlug}
      docs={docs}
      tableAvailable={tableAvailable}
      variant="work"
      linkOptions={linkOptions}
    />
  );
}
