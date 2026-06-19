import {
  MARKETING_EMAIL_URLS,
  renderMarketingCampaignShell,
  renderParagraph,
  renderPrimaryCta,
  renderStepBox,
} from './marketing-campaign-shell';

function renderOnboardingShell(params: {
  title: string;
  preheader: string;
  heroTitle: string;
  heroSubtitle: string;
  bodyHtml: string;
}) {
  return renderMarketingCampaignShell({
    title: params.title,
    preheader: params.preheader,
    heroTitle: params.heroTitle,
    heroSubtitle: params.heroSubtitle,
    ctaHtml: renderPrimaryCta('Continue setup', MARKETING_EMAIL_URLS.onboarding),
    bodyHtml: params.bodyHtml,
  });
}

export function renderNewUserWelcomeEmail() {
  return renderOnboardingShell({
    title: 'Welcome to Ozer',
    preheader: 'Create your first workspace and get started.',
    heroTitle: 'Welcome to Ozer',
    heroSubtitle: 'Your Life OS for community, business, and property.',
    bodyHtml: [
      renderParagraph(
        'Hi {{first_name}}, thanks for signing up. Ozer helps you run community groups, client work, and property portfolios from one account.',
      ),
      renderStepBox(
        'Create a workspace',
        'Choose community, business, or property during onboarding and invite your team when you are ready.',
      ),
    ].join(''),
  });
}

export function renderOnboardingNudge1hEmail() {
  return renderOnboardingShell({
    title: 'Finish setting up Ozer',
    preheader: 'Create your first workspace to unlock the app.',
    heroTitle: 'Finish setting up your workspace',
    heroSubtitle: 'It only takes a few minutes.',
    bodyHtml: renderParagraph(
      'Hi {{first_name}}, you signed up about an hour ago. Complete onboarding to create your first workspace and start using Ozer.',
    ),
  });
}

export function renderOnboardingNudge2dEmail() {
  return renderOnboardingShell({
    title: 'Your workspace is waiting',
    preheader: 'Complete onboarding to unlock clients, tasks, and more.',
    heroTitle: 'Your Ozer workspace is waiting',
    heroSubtitle: 'Pick up where you left off.',
    bodyHtml: renderParagraph(
      'Hi {{first_name}}, onboarding is still incomplete. Finish setup so you can create workspaces, invite teammates, and use your modules.',
    ),
  });
}

export function renderOnboardingNudge1wEmail() {
  return renderOnboardingShell({
    title: 'Can we help you get started?',
    preheader: 'Your account is ready — finish creating your workspace.',
    heroTitle: 'Can we help you get started?',
    heroSubtitle: 'Reply if you need a hand with setup.',
    bodyHtml: renderParagraph(
      'Hi {{first_name}}, your Ozer account is ready but onboarding is not finished yet. Jump back in to create your workspace, or reply if you would like help.',
    ),
  });
}
