import { renderBetaAccessGuideEmail } from './beta-access-guide-campaign';
import { renderBetaDontMissOutCampaignEmail } from './beta-dont-miss-out-campaign';
import { renderBetaLastDayUnpaidEmail } from './beta-last-day-unpaid-campaign';
import { renderBetaWelcomeCampaignEmail } from './beta-welcome-campaign';
import {
  renderNewUserWelcomeEmail,
  renderOnboardingNudge1hEmail,
  renderOnboardingNudge1wEmail,
  renderOnboardingNudge2dEmail,
} from './new-user-campaign-emails';

export type MarketingCampaignTemplateId =
  | 'beta_welcome'
  | 'beta_dont_miss_out'
  | 'beta_access_guide'
  | 'beta_last_day_unpaid'
  | 'new_user_welcome'
  | 'onboarding_nudge_1h'
  | 'onboarding_nudge_2d'
  | 'onboarding_nudge_1w';

export type MarketingCampaignTemplate = {
  label: string;
  description: string;
  defaultTitle: string;
  defaultSubject: string;
  defaultPreviewText: string;
  suggestedRecipientList?:
    | 'beta_users'
    | 'beta_contacts'
    | 'pre_signup_contacts'
    | 'all_users'
    | 'no_subscription';
  render: () => string;
};

export const MARKETING_CAMPAIGN_TEMPLATES: Record<
  MarketingCampaignTemplateId,
  MarketingCampaignTemplate
> = {
  beta_welcome: {
    label: 'Beta welcome (paid, pre-launch)',
    description: 'Payment confirmed — account details arriving soon.',
    defaultTitle: 'Beta welcome email',
    defaultSubject: "You're in — welcome to the Tradeways beta",
    defaultPreviewText:
      'Your payment is confirmed. Account details are on the way.',
    suggestedRecipientList: 'beta_users',
    render: renderBetaWelcomeCampaignEmail,
  },
  beta_dont_miss_out: {
    label: 'Beta interest — general last chance',
    description: 'Original beta closing reminder with feature overview.',
    defaultTitle: 'Beta last chance email',
    defaultSubject: 'Last chance to get beta access for £1',
    defaultPreviewText: 'The £1 beta offer closes soon.',
    suggestedRecipientList: 'pre_signup_contacts',
    render: renderBetaDontMissOutCampaignEmail,
  },
  beta_access_guide: {
    label: 'Beta access — how to sign in',
    description:
      'For new beta users with login access: magic link, onboarding, Quick links, and help.',
    defaultTitle: 'Beta access guide',
    defaultSubject:
      "Your Tradeways beta account is ready — here's how to sign in",
    defaultPreviewText:
      'Create your account at app.tradeways.co.uk/auth/sign-up with your beta email, then complete onboarding.',
    suggestedRecipientList: 'beta_users',
    render: renderBetaAccessGuideEmail,
  },
  beta_last_day_unpaid: {
    label: 'Beta interest — last day to pay £1',
    description:
      'For contacts who expressed interest but have not paid. Today is the last day for £1 access.',
    defaultTitle: 'Beta last day — unpaid interest',
    defaultSubject: 'Last day: £1 for 3 months of Tradeways beta access',
    defaultPreviewText:
      'Today is the last day for £1 beta access. Tomorrow it becomes £24/month.',
    suggestedRecipientList: 'pre_signup_contacts',
    render: renderBetaLastDayUnpaidEmail,
  },
  new_user_welcome: {
    label: 'New user welcome',
    description:
      'Automatic-style welcome for non-beta sign-ups. Getting started without magic link steps.',
    defaultTitle: 'New user welcome',
    defaultSubject: "Welcome to Tradeways — here's how to get started",
    defaultPreviewText:
      'Create your business workspace and start with clients, jobs, and proposals.',
    suggestedRecipientList: 'all_users',
    render: renderNewUserWelcomeEmail,
  },
  onboarding_nudge_1h: {
    label: 'Onboarding nudge — 1 hour',
    description:
      'Sent ~1 hour after sign-up if no business workspace has been created.',
    defaultTitle: 'Onboarding nudge — 1 hour',
    defaultSubject: 'Finish setting up your Tradeways business',
    defaultPreviewText:
      'Create your business workspace to start using Tradeways.',
    suggestedRecipientList: 'no_subscription',
    render: renderOnboardingNudge1hEmail,
  },
  onboarding_nudge_2d: {
    label: 'Onboarding nudge — 2 days',
    description: 'Sent 2 days after sign-up if onboarding is still incomplete.',
    defaultTitle: 'Onboarding nudge — 2 days',
    defaultSubject: 'Your Tradeways workspace is waiting',
    defaultPreviewText:
      'Complete onboarding to unlock clients, jobs, and proposals.',
    suggestedRecipientList: 'no_subscription',
    render: renderOnboardingNudge2dEmail,
  },
  onboarding_nudge_1w: {
    label: 'Onboarding nudge — 1 week',
    description: 'Sent 1 week after sign-up if onboarding is still incomplete.',
    defaultTitle: 'Onboarding nudge — 1 week',
    defaultSubject: 'Can we help you get started with Tradeways?',
    defaultPreviewText:
      'Your account is ready — finish creating your business workspace.',
    suggestedRecipientList: 'no_subscription',
    render: renderOnboardingNudge1wEmail,
  },
};

export const EDITABLE_HTML_TEMPLATE_IDS = new Set<MarketingCampaignTemplateId>(
  Object.keys(MARKETING_CAMPAIGN_TEMPLATES) as MarketingCampaignTemplateId[],
);

export function isEditableHtmlTemplate(
  templateId: string,
): templateId is MarketingCampaignTemplateId {
  return EDITABLE_HTML_TEMPLATE_IDS.has(
    templateId as MarketingCampaignTemplateId,
  );
}

export function getMarketingCampaignTemplate(
  templateId: string,
): MarketingCampaignTemplate | null {
  if (!isEditableHtmlTemplate(templateId)) {
    return null;
  }

  return MARKETING_CAMPAIGN_TEMPLATES[templateId];
}
