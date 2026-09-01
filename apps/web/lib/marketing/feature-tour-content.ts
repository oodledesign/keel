import type { EarlyAccessAccent } from './early-access-content';

export type FeatureTourAccent = EarlyAccessAccent;

export type FeatureTourMock =
  | 'kanban'
  | 'invoice'
  | 'portal'
  | 'notes'
  | 'email'
  | 'requests'
  | 'planner'
  | 'ios';

export type FeatureTourBlock = {
  id: string;
  accent: FeatureTourAccent;
  icon: string;
  eyebrow: string;
  title: string;
  moment: string;
  desc: string;
  highlights: string[];
  mock: FeatureTourMock;
  soon?: boolean;
  soonLabel?: string;
};

export const FEATURE_TOUR_BLOCKS: FeatureTourBlock[] = [
  {
    id: 'pipeline-crm',
    accent: 'cool-blue',
    icon: 'Kanban',
    eyebrow: 'Pipeline & CRM',
    title: 'You always know what happens next with a client.',
    moment:
      'A new enquiry lands while you are in a meeting — you open Ozer later and it is already on the board, with the next step obvious.',
    desc: 'Track enquiries through to signed work without digging through email. One board, one source of truth.',
    highlights: [
      'Kanban board from first enquiry to invoiced',
      'Client records linked to every deal and note',
      'See where each prospect stands at a glance',
      'Nothing slips through because it lived in email',
    ],
    mock: 'kanban',
  },
  {
    id: 'email-assistant',
    accent: 'plum',
    icon: 'Sparkles',
    eyebrow: 'Email assistant',
    title: 'Start the day knowing what actually needs you.',
    moment:
      'You open your inbox and the noise is already sorted — what needs a reply, what is waiting on someone else, and what can wait.',
    desc: 'Drafts replies in your voice and turns action into tasks, so you are responding — not reorganising. Included on Pro.',
    highlights: [
      'Triages your inbox by what needs a reply',
      'Drafts responses in your voice',
      'Turns action items into tasks automatically',
      'Flags threads you should not let slip',
    ],
    mock: 'email',
  },
  {
    id: 'planner',
    accent: 'coral',
    icon: 'CalendarDays',
    eyebrow: 'Planner',
    title: 'Your day has a shape, not just a pile of tasks.',
    moment:
      'It is 9:15 and you can see the call, the deep work block, and when to chase that invoice — without rebuilding the plan in your head.',
    desc: 'Pulls tasks, meetings and deadlines into a schedule you can actually follow. Included on Pro.',
    highlights: [
      'Builds a schedule from tasks and meetings',
      'Shows what to do next, not just what is open',
      'Balances deep work and client calls',
      'Updates as deadlines and priorities shift',
    ],
    mock: 'planner',
  },
  {
    id: 'invoicing',
    accent: 'coral',
    icon: 'FileText',
    eyebrow: 'Invoicing',
    title: 'Getting paid should not need a spreadsheet ritual.',
    moment:
      'You send an invoice after a call and immediately see what is still outstanding — no copying numbers into another tab.',
    desc: 'Professional invoices, payment status, and totals in one place tied to the client.',
    highlights: [
      'Send invoices in a few clicks',
      'Track paid, sent and overdue at a glance',
      'Outstanding totals without a spreadsheet',
      'Invoices tied to the client and project they belong to',
    ],
    mock: 'invoice',
  },
  {
    id: 'client-portals',
    accent: 'sage',
    icon: 'LayoutDashboard',
    eyebrow: 'Client portals',
    title: 'Clients feel looked after, not lost in a folder.',
    moment:
      'They open one link, find the latest files, and sign off — no "which Dropbox was that?" message.',
    desc: 'A branded space for files, updates and approvals tied to the project.',
    highlights: [
      'Share files and updates in one branded space',
      'Clients approve work without email chains',
      'Everything tied to the right project',
      'A client-facing home that looks like your business',
    ],
    mock: 'portal',
  },
  {
    id: 'second-brain',
    accent: 'lime',
    icon: 'Brain',
    eyebrow: 'Second brain',
    title: 'Context is there when the client calls.',
    moment:
      'Five minutes before a catch-up, you pull up the record and the last decision is right where you left it.',
    desc: 'Notes and meeting detail on the client they belong to — searchable when you need them.',
    highlights: [
      'Notes attached to the client they belong to',
      'Meeting summaries searchable when you need them',
      'Tags and context that survives the week',
      'Decisions and details in one place, not five apps',
    ],
    mock: 'notes',
  },
  {
    id: 'client-requests',
    accent: 'plum',
    icon: 'ClipboardList',
    eyebrow: 'Client requests',
    title: 'Scope stays clear without another email thread.',
    moment:
      'A client picks from your menu, you approve in a click, and it lands in your queue — not as a vague "quick favour".',
    desc: 'Services with credit costs, so requests are explicit and billable.',
    highlights: [
      'Publish a menu of services with credit costs',
      'Clients request work without back-and-forth email',
      'Approve or decline in one click',
      'Approved requests land straight in your queue',
    ],
    mock: 'requests',
  },
  {
    id: 'ios-app',
    accent: 'cool-blue',
    icon: 'Smartphone',
    eyebrow: 'iOS app',
    title: 'The studio in your pocket — coming to iPhone.',
    moment:
      'Check tasks, capture a note, look up a person, or dictate after a site visit — without waiting to get back to the Mac.',
    desc: 'A native iPhone app is in progress. Tasks, notes, people, and meetings with on-device dictation. Not in the App Store yet.',
    highlights: [
      'Tasks and notes on the phone you already carry',
      'People and client context away from the desk',
      'Meetings and dictation on device',
      'Same workspace — not a separate mobile product',
    ],
    mock: 'ios',
    soon: true,
    soonLabel: 'Coming soon — native iPhone app',
  },
];
