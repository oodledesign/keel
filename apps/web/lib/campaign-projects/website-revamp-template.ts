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
  { name: 'Onley Law', websiteUrl: 'https://onleylaw.ca/' },
  { name: 'LifePoint Therapy', websiteUrl: 'https://lifepointtherapy.ca' },
  { name: 'Willowworld', websiteUrl: 'https://willowworld.ca/' },
  { name: 'Jon Thompson', websiteUrl: 'https://jonthompsonresources.com' },
  { name: 'Barber Brothers', websiteUrl: 'https://barberbrothers.ca' },
  { name: 'Ibiza Church', websiteUrl: 'https://ibizachurch.com' },
  { name: 'Mount Merrion', websiteUrl: 'https://www.mountmerrionchurch.org.uk/' },
  { name: 'Anwar Knight', websiteUrl: 'https://anwarknight.com' },
  { name: 'J & S Property Management', websiteUrl: 'https://jandspropertymgmt.com' },
  { name: 'Fur A Night or 2', websiteUrl: 'https://furanightor2.ca' },
  { name: 'Relentless Youth', websiteUrl: 'https://wearerelentlessyouth.com/' },
  { name: 'Winds of Change' },
  { name: 'Boyd Mediation & Counselling', websiteUrl: 'https://boydmediationandcounselling.com' },
  { name: 'Pinups & Pompadours', websiteUrl: 'https://pinupsandpompadours.com/' },
  { name: 'Stay Open Safely' },
  { name: 'Josh Gibson Media', websiteUrl: 'https://joshgibsonmedia.com/' },
  { name: 'Dana Levenson', websiteUrl: 'https://danalevenson.com/' },
  { name: 'Royalty Bookkeeping Services', websiteUrl: 'https://royaltybookkeepingservices.ca/' },
  { name: 'Tribal Partners' },
];

export const WEBSITE_REVAMP_CAMPAIGN_NAME = 'Website Revamp Campaign';
