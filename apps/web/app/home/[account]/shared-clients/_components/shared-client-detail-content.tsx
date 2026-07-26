'use client';

import Link from 'next/link';

import { LifeBuoy } from 'lucide-react';

import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';
import type { ClientWorkspaceShare } from '~/lib/clients/client-workspace-shares.service';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

function ModulePanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5">
      <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
        {title}
      </h3>
      <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
        {description}
      </p>
    </div>
  );
}

export function SharedClientDetailContent({
  accountSlug,
  accountId,
  share,
}: {
  accountSlug: string;
  accountId: string;
  share: ClientWorkspaceShare;
}) {
  void accountId;
  const caps = share.capabilities;
  const partnerSupportHref = pathsConfig.app.accountPartnerSupport.replace(
    '[account]',
    accountSlug,
  );
  const partnerSupportNewHref = `${pathsConfig.app.accountPartnerSupportNew.replace('[account]', accountSlug)}?clientOrgId=${share.clientOrgId}`;

  return (
    <div className="space-y-4">
      {caps.canSupport ? (
        <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--workspace-shell-text)]">
                <LifeBuoy className="h-4 w-4" />
                Support
              </h3>
              <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
                Raise and reply to tickets with{' '}
                {share.ownerAccountName ?? 'the agency'}.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={partnerSupportHref}>All partner tickets</Link>
              </Button>
              <Button asChild size="sm" className={workspaceBtnPrimaryMd}>
                <Link href={partnerSupportNewHref}>New ticket</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {caps.canContacts ? (
        <ModulePanel
          title="Contacts"
          description="Contact details for this client are available to your workspace (read-only). Open Partner Support or ask the agency for introductions when needed."
        />
      ) : null}

      {caps.canProjects ? (
        <ModulePanel
          title="Projects"
          description="Project visibility is enabled for this share. Full project boards stay in the agency workspace for now — ask them for status updates as needed."
        />
      ) : null}

      {caps.canDocs ? (
        <ModulePanel
          title="Docs"
          description="Document access is enabled. Shared document browsing will expand here; for now request files via Support."
        />
      ) : null}

      {caps.canFinance ? (
        <ModulePanel
          title="Finance"
          description="Finance visibility is enabled (read-only summary). Detailed billing remains with the agency."
        />
      ) : null}

      {caps.canPortal ? (
        <ModulePanel
          title="Portal"
          description="Client portal access is enabled for this share. Use the agency’s portal links when provided."
        />
      ) : null}

      {!caps.canSupport &&
      !caps.canContacts &&
      !caps.canProjects &&
      !caps.canDocs &&
      !caps.canFinance &&
      !caps.canPortal ? (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          No modules are currently enabled for this share.
        </p>
      ) : null}
    </div>
  );
}
