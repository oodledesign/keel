'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Search } from 'lucide-react';

import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';
import type {
  RanklyClientImportOption,
  RanklyProjectRow,
} from '~/home/[account]/_lib/server/rankly-account-data';

import { RanklyProjectForm } from '~/home/[account]/(rankly)/_components/rankly-project-form';

function projectHref(accountSlug: string, projectId: string) {
  return pathsConfig.app.accountRanklyProjectDetail
    .replace('[account]', accountSlug)
    .replace('[projectId]', projectId);
}

export function ClientRanklyBlock(props: {
  accountSlug: string;
  accountId: string;
  clientId: string;
  project: RanklyProjectRow | null;
  importSeed: RanklyClientImportOption | null;
  clientImportOptions: RanklyClientImportOption[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-3 text-left">
      <div className="flex items-start gap-2">
        <Search className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ozer-accent)]" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">Rankly SEO</p>
          {props.project ? (
            <>
              <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">{props.project.name}</p>
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">{props.project.domain}</p>
              <Link
                href={`${projectHref(props.accountSlug, props.project.id)}#keyword-tracking`}
                className="mt-2 inline-block text-sm text-[var(--ozer-accent-muted)] underline-offset-4 hover:underline"
              >
                Track keywords →
              </Link>
            </>
          ) : (
            <>
              <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
                No SEO project linked to this client yet.
              </p>
              {!open ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  onClick={() => setOpen(true)}
                >
                  Create Rankly project
                </Button>
              ) : (
                <div className="mt-3">
                  <RanklyProjectForm
                    accountId={props.accountId}
                    clientImportOptions={props.clientImportOptions}
                    defaultClientId={props.clientId}
                    onCreated={() => setOpen(false)}
                    onCancel={() => setOpen(false)}
                  />
                </div>
              )}
              {props.importSeed && !props.importSeed.domain && !open ? (
                <p className="mt-2 text-xs text-amber-400/90">
                  No website domain found for this client — add one under
                  Websites or enter the domain manually.
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
