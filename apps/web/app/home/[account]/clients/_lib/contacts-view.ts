import type { ContactCirculationFilter } from '~/lib/commercial/circulation/contact-comms';

export type ContactsView = 'all' | 'requirements' | 'newsletter' | 'attention';

export type ContactsViewState = {
  view: ContactsView;
  circ: ContactCirculationFilter | null;
};

export type ContactsViewCounts = {
  all: number;
  requirements: number;
  newsletter: number;
  attention: number;
  circulation: Record<ContactCirculationFilter, number>;
};

const VIEWS: ContactsView[] = [
  'all',
  'requirements',
  'newsletter',
  'attention',
];
const CIRCULATION_FILTERS: ContactCirculationFilter[] = [
  'subscribed',
  'paused',
  'not_subscribed',
  'unsubscribed',
];

export function parseContactsView(
  params: { view?: string | null; circ?: string | null; list?: string | null },
  options: { commercial: boolean; campaignsEnabled: boolean },
): ContactsViewState {
  let view: ContactsView = VIEWS.includes(params.view as ContactsView)
    ? (params.view as ContactsView)
    : params.list === 'mailing'
      ? 'newsletter'
      : 'all';

  if (view === 'newsletter' && !options.campaignsEnabled) view = 'all';
  if ((view === 'requirements' || view === 'attention') && !options.commercial)
    view = 'all';

  const circ =
    view === 'requirements' &&
    CIRCULATION_FILTERS.includes(params.circ as ContactCirculationFilter)
      ? (params.circ as ContactCirculationFilter)
      : null;

  return { view, circ };
}
