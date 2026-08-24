import Link from 'next/link';

import pathsConfig from '~/config/paths.config';

type EventRow = {
  id: string;
  commenter_username: string | null;
  comment_text: string | null;
  public_reply_status: string | null;
  dm_status: string | null;
  public_reply_ai_credits_spent: number | null;
  dm_ai_credits_spent: number | null;
  pipeline_deal_id: string | null;
  error_message: string | null;
  created_at: string;
};

function StatusBadge({ label }: { label: string | null }) {
  if (!label) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="rounded-full border border-[color:var(--workspace-shell-border)] px-2 py-0.5 text-xs capitalize">
      {label.replace('_', ' ')}
    </span>
  );
}

type InstagramActivityFeedProps = {
  accountSlug: string;
  events: EventRow[];
};

export function InstagramActivityFeed({
  accountSlug,
  events,
}: InstagramActivityFeedProps) {
  const pipelineHref = pathsConfig.app.accountPipeline.replace(
    '[account]',
    accountSlug,
  );

  if (events.length === 0) {
    return (
      <p className="mx-4 text-sm text-[var(--workspace-shell-text-muted)] lg:mx-0">
        No comment events yet. Events appear here when Meta sends webhooks for
        matching comments.
      </p>
    );
  }

  return (
    <ul className="mx-4 divide-y divide-[color:var(--workspace-shell-border)] rounded-lg border border-[color:var(--workspace-shell-border)] lg:mx-0">
      {events.map((event) => {
        const credits =
          Number(event.public_reply_ai_credits_spent ?? 0) +
          Number(event.dm_ai_credits_spent ?? 0);

        return (
          <li key={event.id} className="space-y-2 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">
                @{event.commenter_username ?? 'unknown'}
              </p>
              <time className="text-xs text-[var(--workspace-shell-text-muted)]">
                {new Date(event.created_at).toLocaleString()}
              </time>
            </div>
            <p className="text-sm">{event.comment_text}</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span>Public:</span>
              <StatusBadge label={event.public_reply_status} />
              <span>DM:</span>
              <StatusBadge label={event.dm_status} />
              {credits > 0 ? <span>{credits} AI credits</span> : null}
            </div>
            {event.pipeline_deal_id ? (
              <Link
                href={pipelineHref}
                className="text-xs text-[color:var(--ozer-accent)] hover:underline"
              >
                View pipeline deal
              </Link>
            ) : null}
            {event.error_message ? (
              <p className="text-xs text-red-600">{event.error_message}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
