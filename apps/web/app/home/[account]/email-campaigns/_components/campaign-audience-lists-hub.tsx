'use client';

import Link from 'next/link';

import { Users } from 'lucide-react';

import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';
import {
  audienceListContactSummary,
  audienceListTypeLabel,
  formatAudienceListUpdatedAt,
} from '~/lib/campaigns/campaign-audience-filters';
import type { CampaignAudienceList } from '~/lib/campaigns/campaign.types';
import {
  workspaceBtnPrimary,
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

function newListHref(accountSlug: string) {
  return pathsConfig.app.accountEmailCampaignAudienceNew.replace(
    '[account]',
    accountSlug,
  );
}

function listDetailHref(accountSlug: string, listId: string) {
  return pathsConfig.app.accountEmailCampaignAudienceDetail
    .replace('[account]', accountSlug)
    .replace('[listId]', listId);
}

export function CampaignAudienceListsHub({
  accountSlug,
  lists,
}: {
  accountSlug: string;
  lists: CampaignAudienceList[];
}) {
  const createHref = newListHref(accountSlug);
  const rows = [...lists].sort(
    (left, right) =>
      Date.parse(right.updatedAt) - Date.parse(left.updatedAt) ||
      Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          asChild
          className={workspaceBtnPrimary}
          data-test="audience-new"
        >
          <Link href={createHref}>New list</Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <div
          className={`${workspacePanelCard} px-6 py-12 text-center`}
          data-test="audience-lists-empty"
        >
          <Users className={`mx-auto h-10 w-10 ${workspaceTextMuted}`} />
          <h2 className={`mt-4 text-lg font-semibold ${workspaceText}`}>
            No lists yet
          </h2>
          <p className={`mx-auto mt-2 max-w-md text-sm ${workspaceTextMuted}`}>
            Create a logic list, a manual membership list, or start from a
            category or CSV.
          </p>
          <Button asChild className={`mt-5 ${workspaceBtnPrimary}`}>
            <Link href={createHref}>New list</Link>
          </Button>
        </div>
      ) : (
        <div className={workspacePanelCard} data-test="audience-lists-table">
          <div
            className={`hidden border-b border-[color:var(--workspace-shell-border)] px-4 py-3 text-xs font-medium tracking-wide uppercase md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(8rem,0.9fr)_minmax(7rem,0.7fr)_minmax(7rem,0.6fr)] md:gap-4 ${workspaceTextMuted}`}
          >
            <span>Name</span>
            <span>Type</span>
            <span>Contacts</span>
            <span>Updated</span>
          </div>
          <ul>
            {rows.map((list) => {
              const href = listDetailHref(accountSlug, list.id);
              return (
                <li
                  key={list.id}
                  className="border-b border-[color:var(--workspace-shell-border)] last:border-b-0"
                >
                  <Link
                    href={href}
                    data-test="audience-list-row"
                    className="grid gap-1 px-4 py-4 transition-colors hover:bg-[var(--workspace-shell-panel-hover)] md:grid-cols-[minmax(0,1.4fr)_minmax(8rem,0.9fr)_minmax(7rem,0.7fr)_minmax(7rem,0.6fr)] md:items-center md:gap-4"
                  >
                    <span
                      className={`min-w-0 truncate font-semibold ${workspaceText}`}
                    >
                      {list.name}
                    </span>
                    <span className={`text-sm ${workspaceTextMuted}`}>
                      <span className="md:hidden">Type · </span>
                      {audienceListTypeLabel(list.source)}
                    </span>
                    <span className={`text-sm ${workspaceTextMuted}`}>
                      <span className="md:hidden">Contacts · </span>
                      {audienceListContactSummary(list)}
                    </span>
                    <span className={`text-sm ${workspaceTextMuted}`}>
                      <span className="md:hidden">Updated · </span>
                      {formatAudienceListUpdatedAt(list.updatedAt)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
