import {
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

export function CampaignAudienceCard({
  subscriberCount,
  subscribers,
}: {
  subscriberCount: number;
  subscribers: Array<{
    email: string;
    displayName: string | null;
    consentedAt: string | null;
  }>;
}) {
  return (
    <div className={`${workspacePanelCard} p-4`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className={`font-semibold ${workspaceText}`}>Audience</h2>
        <p className={`text-sm ${workspaceTextMuted}`}>
          {subscriberCount.toLocaleString()} subscribed
        </p>
      </div>
      <p className={`mb-3 text-sm ${workspaceTextMuted}`}>
        Contacts come from the mailing-list form. Unsubscribed and suppressed
        addresses are never sent.
      </p>
      {subscribers.length === 0 ? (
        <p className={`text-sm ${workspaceTextMuted}`}>
          No subscribers yet. Publish a mailing-list form to collect consent.
        </p>
      ) : (
        <ul className="space-y-2">
          {subscribers.map((row) => (
            <li key={row.email} className="text-sm">
              <span className={workspaceText}>
                {row.displayName || row.email}
              </span>
              {row.displayName ? (
                <span className={`ml-2 ${workspaceTextMuted}`}>{row.email}</span>
              ) : null}
            </li>
          ))}
          {subscriberCount > subscribers.length ? (
            <li className={`text-xs ${workspaceTextMuted}`}>
              +{subscriberCount - subscribers.length} more
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
