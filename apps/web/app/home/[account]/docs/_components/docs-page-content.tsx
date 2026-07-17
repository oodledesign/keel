'use client';

import { WorkspaceDocsPage } from '../../_components/workspace-content/workspace-docs-page';
import type {
  DocListItem,
  LinkOption,
  WorkspaceDocsVariant,
} from '../../_lib/workspace-content/types';

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
