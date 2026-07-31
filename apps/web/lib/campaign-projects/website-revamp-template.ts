import type { ProjectFieldType } from './types';

export type WebsiteRevampFieldTemplate = {
  label: string;
  fieldKey: string;
  fieldType: ProjectFieldType;
  options?: { choices?: string[] };
};

export const WEBSITE_REVAMP_CAMPAIGN_FIELDS: WebsiteRevampFieldTemplate[] = [
  {
    label: 'Website URL',
    fieldKey: 'website_url',
    fieldType: 'url',
  },
  {
    label: 'Campaign Status',
    fieldKey: 'campaign_status',
    fieldType: 'select',
    options: {
      choices: [
        'Not started',
        'Outreach sent',
        'In discussion',
        'Proposal sent',
        'Won',
        'Lost',
        'On hold',
      ],
    },
  },
  {
    label: 'Option Selected',
    fieldKey: 'option_selected',
    fieldType: 'select',
    options: { choices: ['Option 1', 'Option 2', 'Option 3'] },
  },
  {
    label: 'Website Type',
    fieldKey: 'website_type',
    fieldType: 'select',
    options: {
      choices: ['WordPress', 'Webflow', 'Next.js', 'Other'],
    },
  },
  {
    label: 'Integrations',
    fieldKey: 'integrations',
    fieldType: 'text',
  },
  {
    label: 'Current Hosting',
    fieldKey: 'current_hosting',
    fieldType: 'text',
  },
  {
    label: 'Option 1 Cost',
    fieldKey: 'option_1_cost',
    fieldType: 'currency',
  },
  {
    label: 'Option 2 Cost',
    fieldKey: 'option_2_cost',
    fieldType: 'currency',
  },
  {
    label: 'Option 3 Cost',
    fieldKey: 'option_3_cost',
    fieldType: 'currency',
  },
  {
    label: 'Website Designer',
    fieldKey: 'website_designer',
    fieldType: 'text',
  },
  {
    label: 'Final Price',
    fieldKey: 'final_price',
    fieldType: 'currency',
  },
];

export const WEBSITE_REVAMP_IMPORT_CLIENTS: Array<{
  name: string;
  websiteUrl?: string;
}> = [
  { name: 'Acme Consulting', websiteUrl: 'https://example.com' },
  { name: 'Northside Bakery', websiteUrl: 'https://example.com' },
  { name: 'River Studio', websiteUrl: 'https://example.com' },
  { name: 'Bright Legal', websiteUrl: 'https://example.com' },
  { name: 'Summit Fitness', websiteUrl: 'https://example.com' },
];

export const WEBSITE_REVAMP_CAMPAIGN_NAME = 'Website Revamp Campaign';
