import type { CampaignBrand, CampaignDocument } from '../campaign-document';
import {
  brandHref,
  buttonBlock,
  campaignDocument,
  columnsBlock,
  dividerBlock,
  headingBlock,
  imageBlock,
  logoBlock,
  paragraphs,
  spacerBlock,
  textBlock,
} from './blocks';

export const CAMPAIGN_TEMPLATE_IDS = [
  'monthly-newsletter',
  'new-service',
  'case-study',
  'welcome',
  'new-listing',
  'available-now',
  'market-update',
  'applicant-requirements',
  'event-invite',
  'simple-announcement',
] as const;

export type CampaignTemplateId = (typeof CAMPAIGN_TEMPLATE_IDS)[number];

export type CampaignTemplateAudience = 'business' | 'property' | 'both';

export type CampaignTemplateWorkspace = 'business' | 'property' | 'all';

export type CampaignTemplateDefinition = {
  id: CampaignTemplateId;
  name: string;
  purpose: string;
  audience: CampaignTemplateAudience;
  subject: string;
  previewText: string;
  build: (brand: CampaignBrand) => CampaignDocument;
};

function monthlyNewsletter(brand: CampaignBrand): CampaignDocument {
  const href = brandHref(brand);
  return campaignDocument(
    logoBlock(),
    headingBlock('A short note this month, {{first_name}}'),
    textBlock(
      paragraphs(
        'No long round-up — just three things we thought were worth your time.',
      ),
    ),
    headingBlock('What’s been keeping us busy', 2),
    textBlock(
      paragraphs(
        'We finished a stretch of client work and have a little more room again. If you’ve been meaning to pick something up with us, now is a good moment.',
      ),
    ),
    buttonBlock('Read the update', href),
    spacerBlock(16),
    headingBlock('A useful thing we learned', 2),
    textBlock(
      paragraphs(
        'Most of the delay on recent jobs wasn’t the work itself — it was waiting on a decision. We’ve started asking for that earlier, and things have moved more calmly.',
      ),
    ),
    buttonBlock('See how we work', href),
    spacerBlock(16),
    headingBlock('Dates for the diary', 2),
    textBlock(
      paragraphs(
        'We’ll be in the studio most of next week and happy to have a proper conversation, not a sales call. Reply to this if a time would help.',
      ),
    ),
    buttonBlock('Reply to us', href),
  );
}

function newService(brand: CampaignBrand): CampaignDocument {
  const href = brandHref(brand);
  return campaignDocument(
    logoBlock(),
    headingBlock('We’ve added something new'),
    textBlock(
      paragraphs(
        'Hello {{first_name}} — we’ve put together a clearer package for the work people ask us for most. Same team, less back-and-forth before you know what you’re getting.',
      ),
    ),
    headingBlock('What it includes', 2),
    textBlock(
      paragraphs(
        '<strong>A fixed starting point</strong> — so you can see the shape of the work before you commit.',
        '<strong>One named person</strong> — you won’t be passed around a inbox.',
        '<strong>A simple written next step</strong> — what happens after the first conversation, in plain English.',
      ),
    ),
    buttonBlock('Have a look at the package', href),
  );
}

function caseStudy(brand: CampaignBrand): CampaignDocument {
  const href = brandHref(brand);
  return campaignDocument(
    logoBlock(),
    headingBlock('A recent piece of work, in brief'),
    textBlock(
      paragraphs(
        'We helped a small team get a stuck project over the line — on time, and without the usual scramble at the end.',
      ),
    ),
    headingBlock('The result', 2),
    textBlock(
      paragraphs(
        'The work shipped in six weeks, the brief stayed intact, and the client had one person to speak to throughout. No extra layers, no surprise invoices.',
      ),
    ),
    dividerBlock(),
    textBlock(
      paragraphs(
        '“They were calm, clear, and on time — which is rarer than it should be.” — {{name}}',
      ),
    ),
    spacerBlock(16),
    textBlock(
      paragraphs(
        'If you’ve got something similar sitting in a drawer, we’re happy to tell you honestly whether we can help.',
      ),
    ),
    buttonBlock('Enquire about a project', href),
  );
}

function welcome(brand: CampaignBrand): CampaignDocument {
  const href = brandHref(brand);
  return campaignDocument(
    logoBlock(),
    headingBlock('Welcome aboard, {{first_name}}'),
    textBlock(
      paragraphs(
        'Thanks for joining the list. We’ll write when there’s something useful — a piece of work, a date, or a short note — and not much else.',
      ),
    ),
    headingBlock('What you’ll get from us', 2),
    textBlock(
      paragraphs(
        'Occasional updates from the studio, the odd useful observation, and first word if we have space for new work. We won’t pass your address on, and you can leave whenever you like.',
      ),
    ),
    headingBlock('A useful first step', 2),
    textBlock(
      paragraphs(
        'If you already know what you need, reply to this email or use the button below. If you don’t, that’s fine — stay on the list and we’ll keep it short.',
      ),
    ),
    buttonBlock('Tell us what you need', href),
  );
}

function newListing(brand: CampaignBrand): CampaignDocument {
  const href = brandHref(brand);
  return campaignDocument(
    logoBlock(),
    headingBlock('14–16 King Street, Manchester'),
    textBlock(paragraphs('To let · 6,200 sq ft · £29.50 psf · FRI lease')),
    imageBlock('Add a photograph of the building or floor plate'),
    textBlock(
      paragraphs(
        '<strong>Size</strong> 6,200 sq ft &nbsp;&nbsp; <strong>Rent</strong> £29.50 psf &nbsp;&nbsp; <strong>Tenure</strong> FRI',
        'A well-lit floor in a solid city-centre building, close to the station and the usual lunchtime options. Suitable for a professional occupier who wants to be in, not waiting on a refurbishment story.',
      ),
    ),
    buttonBlock('Request details', href),
    spacerBlock(8),
    buttonBlock('Book a viewing', href),
  );
}

function availableNow(brand: CampaignBrand): CampaignDocument {
  const href = brandHref(brand);
  return campaignDocument(
    logoBlock(),
    headingBlock('Two spaces available now'),
    textBlock(
      paragraphs(
        'Hello {{first_name}} — both of these can be viewed this week. Reply with the one you want to see, or ask us to send the particulars.',
      ),
    ),
    columnsBlock(
      { kind: 'image', src: '', alt: 'Add a photo of the first listing' },
      { kind: 'image', src: '', alt: 'Add a photo of the second listing' },
    ),
    columnsBlock(
      {
        kind: 'text',
        html: paragraphs(
          '<strong>Unit 4, Mersey Wharf, Liverpool</strong>',
          '3,400 sq ft · £18.50 psf · FRI',
          'Ground-floor warehouse with yard access. Immediate occupation.',
        ),
      },
      {
        kind: 'text',
        html: paragraphs(
          '<strong>2nd floor, 8 Park Row, Leeds</strong>',
          '2,150 sq ft · £27.00 psf · FRI',
          'Fitted offices, good natural light, short walk from the station.',
        ),
      },
    ),
    buttonBlock('See all availability', href),
  );
}

function marketUpdate(brand: CampaignBrand): CampaignDocument {
  const href = brandHref(brand);
  return campaignDocument(
    logoBlock(),
    headingBlock('A quick note on the local market'),
    textBlock(
      paragraphs(
        '{{first_name}}, occupiers are still taking space — but they are slower to commit, and they want the numbers in writing. Landlords who can show a clear rent, a realistic rent-free, and a viewing this week are the ones moving.',
      ),
    ),
    headingBlock('Featured this week', 2),
    imageBlock('Add a photograph of the featured property'),
    textBlock(
      paragraphs(
        '<strong>The Old Sorting Office, Bristol</strong> — 9,800 sq ft, £22.50 psf, FRI. A character building with decent floor loading and a landlord who will talk.',
      ),
    ),
    buttonBlock('Request the particulars', href),
  );
}

function applicantRequirements(brand: CampaignBrand): CampaignDocument {
  const href = brandHref(brand);
  return campaignDocument(
    logoBlock(),
    headingBlock('Tell us what you’re looking for'),
    textBlock(
      paragraphs(
        'Hello {{first_name}} — if you send a short brief, we’ll match it against what’s coming through and only get in touch when something is actually a fit.',
      ),
    ),
    headingBlock('Useful to include', 2),
    textBlock(
      paragraphs(
        '<strong>Area</strong> — town, pitch, or a few postcodes.',
        '<strong>Size and budget</strong> — even a range is enough.',
        '<strong>Timing</strong> — now, three months, or “if the right thing appears”.',
      ),
    ),
    textBlock(
      paragraphs(
        `We’ll use the address we have for you ({{email}}) unless you tell us otherwise.`,
      ),
    ),
    buttonBlock('Send your requirement', href),
  );
}

function eventInvite(brand: CampaignBrand): CampaignDocument {
  const href = brandHref(brand);
  return campaignDocument(
    logoBlock(),
    headingBlock('You’re invited, {{first_name}}'),
    textBlock(
      paragraphs(
        'A short viewing / open morning — no presentation deck, just the space and time to ask questions.',
      ),
    ),
    headingBlock('Thursday 18 September, 8.30–10.00am', 2),
    textBlock(
      paragraphs(
        '<strong>Where</strong> 14–16 King Street, Manchester (two minutes from the station).',
        '<strong>What to expect</strong> Coffee, a walk-round, and someone who can talk rent and timing without fetching a colleague.',
      ),
    ),
    buttonBlock('RSVP', href),
  );
}

function simpleAnnouncement(brand: CampaignBrand): CampaignDocument {
  const href = brandHref(brand);
  return campaignDocument(
    logoBlock(),
    headingBlock('A note for you, {{first_name}}'),
    textBlock(
      paragraphs(
        'We wanted you to hear this from us first. The details are below — and if you’d rather talk it through, reply or use the button.',
      ),
    ),
    buttonBlock('Read more', href),
  );
}

export const CAMPAIGN_TEMPLATES: CampaignTemplateDefinition[] = [
  {
    id: 'monthly-newsletter',
    name: 'Monthly newsletter',
    purpose: 'Stay-in-touch note for your mailing list',
    audience: 'business',
    subject: 'A short note this month, {{first_name}}',
    previewText: 'Three things from us — no fluff.',
    build: monthlyNewsletter,
  },
  {
    id: 'new-service',
    name: 'New service / offer',
    purpose: 'Announce a service or package',
    audience: 'business',
    subject: 'We’ve added something new',
    previewText: 'A clearer package, same team.',
    build: newService,
  },
  {
    id: 'case-study',
    name: 'Case study',
    purpose: 'Show a recent project and invite an enquiry',
    audience: 'business',
    subject: 'A recent piece of work, in brief',
    previewText: 'How the job actually went.',
    build: caseStudy,
  },
  {
    id: 'welcome',
    name: 'Welcome',
    purpose: 'Thank new subscribers and set expectations',
    audience: 'business',
    subject: 'Welcome aboard, {{first_name}}',
    previewText: 'What you’ll hear from us — and what you won’t.',
    build: welcome,
  },
  {
    id: 'new-listing',
    name: 'New listing',
    purpose: 'Launch a single property with a viewing CTA',
    audience: 'property',
    subject: 'To let: 14–16 King Street, Manchester',
    previewText: '6,200 sq ft · £29.50 psf · viewings this week.',
    build: newListing,
  },
  {
    id: 'available-now',
    name: 'Available now',
    purpose: 'Show two listings side by side',
    audience: 'property',
    subject: 'Two spaces available now',
    previewText: 'Liverpool and Leeds — both viewable this week.',
    build: availableNow,
  },
  {
    id: 'market-update',
    name: 'Market update',
    purpose: 'A brief local note plus one featured property',
    audience: 'property',
    subject: 'A quick note on the local market',
    previewText: 'What’s moving, and one building worth a look.',
    build: marketUpdate,
  },
  {
    id: 'applicant-requirements',
    name: 'Applicant requirements',
    purpose: 'Ask occupiers to send a short brief',
    audience: 'property',
    subject: 'Tell us what you’re looking for',
    previewText: 'A short brief is enough — we’ll only reply when it’s a fit.',
    build: applicantRequirements,
  },
  {
    id: 'event-invite',
    name: 'Event / viewing invite',
    purpose: 'Invite people to a date, place, and RSVP',
    audience: 'both',
    subject: 'You’re invited, {{first_name}}',
    previewText: 'Thursday 18 September — a short viewing, not a presentation.',
    build: eventInvite,
  },
  {
    id: 'simple-announcement',
    name: 'Simple announcement',
    purpose: 'A designed short note with one button',
    audience: 'both',
    subject: 'A note for you, {{first_name}}',
    previewText: 'A short update from us.',
    build: simpleAnnouncement,
  },
];

export function listCampaignTemplates(
  workspace: CampaignTemplateWorkspace = 'all',
): CampaignTemplateDefinition[] {
  if (workspace === 'all') return CAMPAIGN_TEMPLATES;
  return CAMPAIGN_TEMPLATES.filter(
    (template) =>
      template.audience === 'both' || template.audience === workspace,
  );
}

export function campaignTemplateWorkspaceFromProfile(
  profile: string | null | undefined,
): CampaignTemplateWorkspace {
  // Campaigns ships on Business workspaces (work_design / work_property)
  // and Commercial Property. Property-listing templates are for the
  // commercial_property space only.
  if (profile === 'commercial_property') return 'property';
  if (profile === 'work_design' || profile === 'work_property') {
    return 'business';
  }
  return 'all';
}

export function getCampaignTemplate(
  id: string,
): CampaignTemplateDefinition | null {
  return CAMPAIGN_TEMPLATES.find((template) => template.id === id) ?? null;
}

export function instantiateCampaignTemplate(
  template: CampaignTemplateDefinition,
  brand: CampaignBrand,
): CampaignDocument {
  return template.build(brand);
}

export function campaignTemplateAudienceLabel(
  audience: CampaignTemplateAudience,
): string {
  if (audience === 'business') return 'Business';
  if (audience === 'property') return 'Property';
  return 'Both';
}
