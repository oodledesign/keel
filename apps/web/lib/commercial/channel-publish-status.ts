import {
  isEachFeedIncluded,
  isWebsiteFeedIncluded,
} from '~/lib/commercial/each-feed-inclusion';

export type ChannelPublishState = 'live' | 'off' | 'blocked' | 'unavailable';

export type ChannelPublishStatus = {
  state: ChannelPublishState;
  /** Opt-out switch position (true = not unpublished). */
  switchOn: boolean;
  /** Whether the user may turn the switch ON. */
  canEnable: boolean;
  /** Short badge label. */
  label: string;
  /** One-line explanation under the channel name. */
  detail: string;
  /** Missing quals shown when switch cannot be enabled / state is blocked. */
  blockers: string[];
  lastError: string | null;
};

type ListingInput = {
  status: string;
  externalId: string | null;
  websiteUrl?: string | null;
  sizeMinSqft?: number | null;
  name?: string | null;
  postcode?: string | null;
  disposalType?: string | null;
};

type PublicationInput = {
  portal: string;
  status: string;
  lastError?: string | null;
  externalId?: string | null;
  externalUrl?: string | null;
};

const ON_MARKET = new Set(['marketing', 'under_offer']);

function isOnMarket(status: string): boolean {
  return ON_MARKET.has(status);
}

function eachFieldBlockers(listing: ListingInput): string[] {
  const blockers: string[] = [];
  if (!listing.name?.trim()) blockers.push('Add a disposal name');
  if (!listing.postcode?.trim()) blockers.push('Add a postcode');
  if (listing.sizeMinSqft == null) {
    blockers.push('Set size from (sq ft)');
  }
  if (!listing.disposalType) blockers.push('Set disposal type');
  return blockers;
}

export function getWebsiteChannelStatus(input: {
  listing: ListingInput;
  publications: PublicationInput[];
}): ChannelPublishStatus {
  const { listing, publications } = input;
  const pub = publications.find((p) => p.portal === 'property_hive');
  const switchOn = isWebsiteFeedIncluded(publications);
  const onMarket = isOnMarket(listing.status);
  const hasFeedId = Boolean(listing.externalId?.trim());
  const lastError = pub?.lastError?.trim() || null;

  const enableBlockers: string[] = [];
  if (!onMarket) {
    enableBlockers.push('Set status to Marketing or Under offer');
  }

  if (!switchOn) {
    return {
      state: 'off',
      switchOn: false,
      canEnable: enableBlockers.length === 0,
      label: 'Off',
      detail: 'Not on the website feed',
      blockers: enableBlockers,
      lastError: null,
    };
  }

  const blockers: string[] = [];
  if (!onMarket) {
    blockers.push('Set status to Marketing or Under offer');
  }
  if (!hasFeedId) {
    blockers.push(
      'Missing website feed id — turn Website off and on, or retry publish',
    );
  }
  if (lastError && /credentials not configured/i.test(lastError)) {
    // XML-feed workspaces do not need REST credentials; ignore stale API errors.
  } else if (lastError && pub?.status === 'error') {
    blockers.push(lastError);
  }

  if (blockers.length > 0) {
    return {
      state: 'blocked',
      switchOn: true,
      canEnable: true,
      label: 'Blocked',
      detail: 'Not publishing to the website yet',
      blockers,
      lastError,
    };
  }

  return {
    state: 'live',
    switchOn: true,
    canEnable: true,
    label: 'Live',
    detail: 'In the website feed — site updates after Property Hive imports',
    blockers: [],
    lastError: null,
  };
}

export function getEachChannelStatus(input: {
  listing: ListingInput;
  publications: PublicationInput[];
}): ChannelPublishStatus {
  const { listing, publications } = input;
  const pub = publications.find((p) => p.portal === 'each');
  const switchOn = isEachFeedIncluded(publications);
  const onMarket = isOnMarket(listing.status);
  const fieldBlockers = eachFieldBlockers(listing);
  const lastError = pub?.lastError?.trim() || null;

  const enableBlockers: string[] = [];
  if (!onMarket) {
    enableBlockers.push('Set status to Marketing or Under offer');
  }
  enableBlockers.push(...fieldBlockers);

  if (!switchOn) {
    return {
      state: 'off',
      switchOn: false,
      canEnable: enableBlockers.length === 0,
      label: 'Off',
      detail: 'Excluded from the EACH feed',
      blockers: enableBlockers,
      lastError: null,
    };
  }

  const blockers: string[] = [];
  if (!onMarket) {
    blockers.push('Set status to Marketing or Under offer');
  }
  blockers.push(...fieldBlockers);
  if (lastError && !fieldBlockers.some((b) => lastError.includes('size_min'))) {
    // Surface stored feed warnings that are not already covered
    if (/Missing EACH/i.test(lastError) && listing.sizeMinSqft == null) {
      // already covered by fieldBlockers
    } else if (pub?.status === 'error') {
      blockers.push(lastError);
    }
  }

  if (blockers.length > 0) {
    return {
      state: 'blocked',
      switchOn: true,
      canEnable: fieldBlockers.length === 0 && onMarket,
      label: 'Blocked',
      detail: 'Not exporting to EACH yet',
      blockers,
      lastError,
    };
  }

  return {
    state: 'live',
    switchOn: true,
    canEnable: true,
    label: 'Live',
    detail: 'In the EACH feed when Property Hive / EACH next imports',
    blockers: [],
    lastError: null,
  };
}

export function getRightmoveChannelStatus(): ChannelPublishStatus {
  return {
    state: 'unavailable',
    switchOn: false,
    canEnable: false,
    label: 'Coming soon',
    detail: 'Rightmove is not live yet',
    blockers: [],
    lastError: null,
  };
}

export function isSafeHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
