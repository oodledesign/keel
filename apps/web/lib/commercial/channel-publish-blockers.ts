import type { ChannelPublishStatus } from '~/lib/commercial/channel-publish-status';
import { LISTING_STATUS_LABELS } from '~/lib/commercial/commercial-constants';
import {
  type ListingTabKey,
  listingEditStatusHref,
  listingTabHref,
} from '~/lib/commercial/listing-routes';
import type { MarketingReadiness } from '~/lib/commercial/marketing-readiness';

export type ChannelPublishBlockerSeverity = 'required' | 'checklist';

export type ChannelPublishBlocker = {
  id: string;
  label: string;
  hint: string;
  href?: string;
  actionLabel?: string;
  severity: ChannelPublishBlockerSeverity;
};

const STATUS_BLOCKER = 'Set status to Marketing or Under offer';

function statusLabel(status: string) {
  return (
    LISTING_STATUS_LABELS[status as keyof typeof LISTING_STATUS_LABELS] ??
    status
  );
}

function mapChannelBlocker(input: {
  text: string;
  accountSlug: string;
  listingId: string;
  listingStatus: string;
}): ChannelPublishBlocker {
  const { text, accountSlug, listingId, listingStatus } = input;
  const editHref = listingTabHref(accountSlug, listingId, 'edit');
  const statusHref = listingEditStatusHref(accountSlug, listingId);

  if (text === STATUS_BLOCKER || /Marketing or Under offer/i.test(text)) {
    const current = statusLabel(listingStatus);
    return {
      id: 'status',
      label: `Change status from ${current} → Marketing or Under offer`,
      hint: 'Channels only go live when the disposal is on the market.',
      href: statusHref,
      actionLabel: 'Edit status',
      severity: 'required',
    };
  }

  if (/disposal name/i.test(text)) {
    return {
      id: 'name',
      label: text,
      hint: 'Required before this channel can go live.',
      href: editHref,
      actionLabel: 'Open Edit',
      severity: 'required',
    };
  }

  if (/postcode/i.test(text)) {
    return {
      id: 'postcode',
      label: text,
      hint: 'Required before this channel can go live.',
      href: editHref,
      actionLabel: 'Open Edit',
      severity: 'required',
    };
  }

  if (/address line 1/i.test(text)) {
    return {
      id: 'address',
      label: text,
      hint: 'Required before this channel can go live.',
      href: editHref,
      actionLabel: 'Open Edit',
      severity: 'required',
    };
  }

  if (/size from/i.test(text)) {
    return {
      id: 'size',
      label: text,
      hint: 'Required for the EACH feed.',
      href: editHref,
      actionLabel: 'Open Edit',
      severity: 'required',
    };
  }

  if (/disposal type/i.test(text)) {
    return {
      id: 'disposal_type',
      label: text,
      hint: 'Required for the EACH feed.',
      href: editHref,
      actionLabel: 'Open Edit',
      severity: 'required',
    };
  }

  if (/feed id/i.test(text)) {
    return {
      id: 'feed_id',
      label: text,
      hint: 'Use Assign feed id on this page, or turn Website off and on.',
      href: listingTabHref(accountSlug, listingId, 'publishing'),
      actionLabel: 'Back to Channels',
      severity: 'required',
    };
  }

  return {
    id: `channel:${text}`,
    label: text,
    hint: 'Fix this before the channel can go live.',
    severity: 'required',
  };
}

function checklistActionLabel(tab: ListingTabKey | undefined) {
  switch (tab) {
    case 'media':
      return 'Open Media';
    case 'marketing':
      return 'Open Marketing';
    case 'management':
      return 'Open Management';
    case 'overview':
      return 'Open Overview';
    case 'publishing':
      return 'Open Publishing';
    case 'edit':
      return 'Open Edit';
    default:
      return 'Open';
  }
}

export function collectChannelPublishBlockers(input: {
  channel: ChannelPublishStatus;
  readiness: MarketingReadiness;
  accountSlug: string;
  listingId: string;
  listingStatus: string;
  extraRequired?: ChannelPublishBlocker[];
}): ChannelPublishBlocker[] {
  const {
    channel,
    readiness,
    accountSlug,
    listingId,
    listingStatus,
    extraRequired = [],
  } = input;

  const items: ChannelPublishBlocker[] = [];
  const seen = new Set<string>();

  const push = (item: ChannelPublishBlocker) => {
    if (seen.has(item.id) || seen.has(item.label)) return;
    seen.add(item.id);
    seen.add(item.label);
    items.push(item);
  };

  for (const text of channel.blockers) {
    push(
      mapChannelBlocker({
        text,
        accountSlug,
        listingId,
        listingStatus,
      }),
    );
  }

  for (const extra of extraRequired) {
    push(extra);
  }

  for (const item of readiness.items.filter((entry) => !entry.pass)) {
    const href = item.hrefTab
      ? listingTabHref(accountSlug, listingId, item.hrefTab)
      : undefined;
    push({
      id: `readiness:${item.id}`,
      label: item.label,
      hint: item.hint,
      href,
      actionLabel: href ? checklistActionLabel(item.hrefTab) : undefined,
      severity: 'checklist',
    });
  }

  return items;
}
