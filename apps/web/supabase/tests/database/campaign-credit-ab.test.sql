begin;

select plan(6);

select has_column('public', 'campaign_credit_pools', 'bonus_contacts',
  'campaign_credit_pools has bonus_contacts');

select has_column('public', 'workspace_email_campaigns', 'ab_enabled',
  'campaigns have ab_enabled');

select has_column('public', 'workspace_email_campaigns', 'subject_b',
  'campaigns have subject_b');

select has_column('public', 'workspace_email_campaign_recipients', 'subject_variant',
  'recipients have subject_variant');

select has_function('public', 'apply_campaign_contact_bump');

select has_function('public', 'grant_campaign_credits');

select * from finish();

rollback;
