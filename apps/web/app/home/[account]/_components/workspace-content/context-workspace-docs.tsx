'use client';

import type {
  DocListItem,
  LinkOption,
} from '../../_lib/workspace-content/types';
import type { LinkValue } from './link-to-select';
import { WorkspaceDocsPage } from './workspace-docs-page';

export function ContextWorkspaceDocs({
  accountId,
  accountSlug,
  docs,
  tableAvailable,
  linkOptions,
  defaultLink,
}: {
  accountId: string;
  accountSlug: string;
  docs: DocListItem[];
  tableAvailable: boolean;
  linkOptions: LinkOption[];
  defaultLink: LinkValue;
}) {
  return (
    <WorkspaceDocsPage
      accountId={accountId}
      accountSlug={accountSlug}
      docs={docs}
      tableAvailable={tableAvailable}
      variant="work"
      linkOptions={linkOptions}
      defaultLink={defaultLink}
    />
  );
}
