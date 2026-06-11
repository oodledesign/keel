import {
  MARKETING_EMAIL_URLS,
  renderMarketingCampaignShell,
  renderParagraph,
  renderPrimaryCta,
  renderStepBox,
} from './marketing-campaign-shell';

export function renderBetaAccessGuideEmail() {
  return renderMarketingCampaignShell({
    title: 'Your beta account is ready',
    preheader: 'Sign in with your beta email and complete onboarding.',
    heroBadge: 'Beta access',
    heroTitle: 'Your Keel beta account is ready',
    heroSubtitle: 'Here is how to sign in and get started.',
    ctaHtml: renderPrimaryCta('Sign in to Keel', MARKETING_EMAIL_URLS.signIn),
    bodyHtml: [
      renderParagraph(
        'Hi {{first_name}}, your beta access is live. Use the same email address you registered with ({{email}}).',
      ),
      renderStepBox(
        '1. Sign in',
        `Open <a href="${MARKETING_EMAIL_URLS.signIn}">${MARKETING_EMAIL_URLS.signIn}</a> and request a magic link, or create your password if you already set one up.`,
      ),
      renderStepBox(
        '2. Complete onboarding',
        `Follow the setup flow at <a href="${MARKETING_EMAIL_URLS.onboarding}">${MARKETING_EMAIL_URLS.onboarding}</a> to create your first workspace.`,
      ),
      renderStepBox(
        '3. Need help?',
        `Reply to this email or contact us at <a href="${MARKETING_EMAIL_URLS.support}">${MARKETING_EMAIL_URLS.support}</a>.`,
      ),
    ].join(''),
  });
}
