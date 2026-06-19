import {
  MARKETING_EMAIL_URLS,
  renderBulletList,
  renderMarketingCampaignShell,
  renderParagraph,
  renderPrimaryCta,
  renderSectionLabel,
} from './marketing-campaign-shell';

export function renderBetaDontMissOutCampaignEmail() {
  return renderMarketingCampaignShell({
    title: 'Last chance for beta access',
    preheader: 'The beta offer closes soon.',
    heroBadge: 'Beta',
    heroTitle: 'Last chance to get beta access',
    heroSubtitle: 'Community, business, and property workspaces in one place.',
    ctaHtml: renderPrimaryCta('Get beta access', MARKETING_EMAIL_URLS.signUp),
    bodyHtml: [
      renderParagraph(
        'Hi {{first_name}}, the Ozer beta window is closing soon. If you have been waiting, now is the time to claim your spot.',
      ),
      renderSectionLabel('What you get'),
      renderBulletList([
        'Workspaces for community, business, and property',
        'Tasks, clients, proposals, and more in one Life OS',
        'Early access pricing while we finish the launch',
      ]),
    ].join(''),
  });
}
