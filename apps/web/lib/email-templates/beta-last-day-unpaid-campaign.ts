import {
  MARKETING_EMAIL_URLS,
  renderMarketingCampaignShell,
  renderParagraph,
  renderPrimaryCta,
} from './marketing-campaign-shell';

export function renderBetaLastDayUnpaidEmail() {
  return renderMarketingCampaignShell({
    title: 'Last day for beta pricing',
    preheader: 'Today is the last day for introductory beta access.',
    heroBadge: 'Final reminder',
    heroTitle: 'Last day for beta access',
    heroSubtitle: 'Complete your signup before the offer closes.',
    ctaHtml: renderPrimaryCta('Finish signup', MARKETING_EMAIL_URLS.signUp),
    bodyHtml: [
      renderParagraph(
        'Hi {{first_name}}, you expressed interest in the Ozer beta but have not finished signup yet.',
      ),
      renderParagraph(
        'Today is the last day to lock in introductory beta access. After that, standard pricing applies.',
      ),
    ].join(''),
  });
}
