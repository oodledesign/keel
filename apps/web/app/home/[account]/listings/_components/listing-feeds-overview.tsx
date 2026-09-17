import type { ListingFeedChannel } from '~/lib/commercial/listing-feed-channels';

import { ChannelStatusPill } from './listing-channel-status-pill';

export function ListingFeedsOverview({
  channels,
}: {
  channels: ListingFeedChannel[];
}) {
  return (
    <>
      <p className="mb-2 text-[11px] font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
        Feeds
      </p>
      <ul className="flex flex-wrap gap-2">
        {channels.map((channel) => (
          <li key={channel.key} data-test={`listing-feeds-row-${channel.key}`}>
            <ChannelStatusPill label={channel.label} status={channel.status} />
          </li>
        ))}
      </ul>
    </>
  );
}
