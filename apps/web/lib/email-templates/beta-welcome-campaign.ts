import {
  MARKETING_EMAIL_URLS,
  renderMarketingCampaignShell,
  renderParagraph,
  renderPrimaryCta,
} from './marketing-campaign-shell';

export function renderBetaWelcomeCampaignEmail() {
  return renderMarketingCampaignShell({
    title: 'Welcome to the beta',
    preheader: 'Your payment is confirmed. Account details are on the way.',
    heroBadge: 'Beta',
    heroTitle: "You're in — welcome to Ozer",
    heroSubtitle: 'Your payment is confirmed. Account details are on the way.',
    ctaHtml: renderPrimaryCta('Sign in to Ozer', MARKETING_EMAIL_URLS.signIn),
    bodyHtml: [
      renderParagraph(
        'Hi {{first_name}}, thanks for joining the Ozer beta. We are rolling out access in waves and will email you when your workspace is ready.',
      ),
      renderParagraph(
        'In the meantime, bookmark the app and complete onboarding when you receive your access email.',
      ),
    ].join(''),
  });
}
