import { describe, expect, it } from 'vitest';

import { compileCampaignDocument } from '../compile-campaign-document';
import { applyCampaignMergeFields } from '../merge-fields';
import {
  CAMPAIGN_TEMPLATES,
  campaignTemplateWorkspaceFromProfile,
  instantiateCampaignTemplate,
  listCampaignTemplates,
} from './catalog';

const brand = {
  primary_color: '#0D2344',
  secondary_color: '#FFFFFF',
  accent_color: '#57C87F',
  logo_url: 'https://cdn.example.com/logo.png',
  website_url: 'https://studio.example.co.uk',
};

describe('campaign templates', () => {
  it('ships the ten v1 templates', () => {
    expect(CAMPAIGN_TEMPLATES.map((template) => template.id)).toEqual([
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
    ]);
  });

  it('filters the gallery by workspace profile', () => {
    expect(campaignTemplateWorkspaceFromProfile('commercial_property')).toBe(
      'property',
    );
    expect(campaignTemplateWorkspaceFromProfile('work_design')).toBe(
      'business',
    );

    const property = listCampaignTemplates('property').map((item) => item.id);
    const business = listCampaignTemplates('business').map((item) => item.id);

    expect(property).toContain('new-listing');
    expect(property).toContain('event-invite');
    expect(property).not.toContain('monthly-newsletter');

    expect(business).toContain('monthly-newsletter');
    expect(business).toContain('simple-announcement');
    expect(business).not.toContain('new-listing');
  });

  it('compiles each template with brand, merge fields, and unsubscribe', () => {
    for (const template of CAMPAIGN_TEMPLATES) {
      const document = instantiateCampaignTemplate(template, brand);
      expect(document.blocks.at(-1)?.type).toBe('footer');

      const html = compileCampaignDocument(document, brand, {
        unsubscribeUrl: 'https://example.co.uk/unsub',
      });
      const merged = applyCampaignMergeFields(html, {
        name: 'Alex Taylor',
        firstName: 'Alex',
        email: 'alex@example.co.uk',
      });

      expect(merged).toContain('https://cdn.example.com/logo.png');
      expect(merged).toContain('Unsubscribe');
      expect(merged).toContain('https://example.co.uk/unsub');
      expect(merged).not.toContain('display:flex');
      expect(merged).not.toContain('display:grid');
    }
  });

  it('uses British copy and merge tokens in the designed templates', () => {
    const caseStudy = instantiateCampaignTemplate(
      CAMPAIGN_TEMPLATES.find((item) => item.id === 'case-study')!,
      brand,
    );
    const listing = instantiateCampaignTemplate(
      CAMPAIGN_TEMPLATES.find((item) => item.id === 'new-listing')!,
      brand,
    );
    const welcome = instantiateCampaignTemplate(
      CAMPAIGN_TEMPLATES.find((item) => item.id === 'welcome')!,
      brand,
    );

    const caseHtml = compileCampaignDocument(caseStudy, brand);
    const listingHtml = compileCampaignDocument(listing, brand);
    const welcomeHtml = compileCampaignDocument(welcome, brand);

    expect(caseHtml).toContain('Enquire');
    expect(caseHtml).toContain('{{name}}');
    expect(listingHtml).toContain('Book a viewing');
    expect(welcomeHtml).toContain('{{first_name}}');
  });
});
