'use client';

import Link from 'next/link';

import { Badge } from '@kit/ui/badge';

import pathsConfig from '~/config/paths.config';
import {
  workspaceBtnPrimaryMd,
  workspacePanelBorder,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import type { MeetingPollListRow } from '../_lib/server/meeting-polls.service';

const STATUS_LABEL: Record<MeetingPollListRow['status'], string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Confirmed',
  cancelled: 'Cancelled',
};

export function PollsList({
  accountSlug,
  canEdit,
  polls,
}: {
  accountSlug: string;
  canEdit: boolean;
  polls: MeetingPollListRow[];
}) {
  const createHref = pathsConfig.app.accountSchedulingPollNew.replace(
    '[account]',
    accountSlug,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={`text-sm ${workspaceTextMuted}`}>
          Ask a group which time works, then confirm one slot and send a
          calendar invite.
        </p>
        {canEdit ? (
          <Link href={createHref} className={workspaceBtnPrimaryMd}>
            New poll
          </Link>
        ) : null}
      </div>
      {polls.length === 0 ? (
        <div className={`rounded-2xl border p-6 ${workspacePanelBorder}`}>
          <p>No meeting polls yet.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {polls.map((poll) => (
            <li key={poll.id}>
              <Link
                href={pathsConfig.app.accountSchedulingPoll
                  .replace('[account]', accountSlug)
                  .replace('[pollId]', poll.id)}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${workspacePanelBorder}`}
              >
                <span>
                  <span className="font-medium">{poll.title}</span>
                  <span className={`mt-1 block text-sm ${workspaceTextMuted}`}>
                    {poll.respondedCount} of {poll.inviteeCount} responded ·{' '}
                    {poll.durationMinutes} min · {poll.timezone}
                  </span>
                </span>
                <Badge variant="outline">{STATUS_LABEL[poll.status]}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
