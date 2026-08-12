-- Idempotent screenshot seed for commercial workspace slug: test-commercial-property
-- Safe to re-run. Marks rows with source/notes containing [ozer-demo-seed].
-- Does NOT create the workspace — account must already exist.

-- Fixed IDs (deterministic)
-- account: looked up by slug
-- owner/member: looked up from memberships / auth

begin;

create temporary table _demo_ctx as
select
  a.id as account_id,
  a.primary_owner_user_id as owner_id,
  a.slug
from public.accounts a
where a.slug = 'test-commercial-property'
  and a.space_type = 'commercial-property'
limit 1;

do $$
begin
  if not exists (select 1 from _demo_ctx) then
    raise exception 'Account slug test-commercial-property (commercial-property) not found';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Cleanup previous demo rows (children first)
-- ---------------------------------------------------------------------------
delete from public.commercial_viewings v
using _demo_ctx c
where v.account_id = c.account_id
  and (v.feedback ilike '%[ozer-demo-seed]%' or v.outcome ilike '%[ozer-demo-seed]%');

delete from public.commercial_matches m
using _demo_ctx c
where m.account_id = c.account_id
  and m.notes ilike '%[ozer-demo-seed]%';

delete from public.commercial_enquiries e
using _demo_ctx c
where e.account_id = c.account_id
  and (e.message ilike '%[ozer-demo-seed]%' or e.external_ref like 'ozer-demo-%');

delete from public.pipeline_deals d
using _demo_ctx c
where d.account_id = c.account_id
  and (d.notes ilike '%[ozer-demo-seed]%' or d.id::text like 'c0a10006-%');

delete from public.commercial_requirements r
using _demo_ctx c
where r.account_id = c.account_id
  and (r.notes ilike '%[ozer-demo-seed]%' or r.source = 'ozer-demo-seed');

delete from public.commercial_leases l
using _demo_ctx c
where l.account_id = c.account_id
  and l.notes ilike '%[ozer-demo-seed]%';

delete from public.commercial_listing_units u
using _demo_ctx c
where u.account_id = c.account_id
  and u.label like 'Demo %';

delete from public.contact_email_addresses cea
using public.contacts ct, _demo_ctx c
where cea.contact_id = ct.id
  and ct.account_id = c.account_id
  and ct.notes ilike '%[ozer-demo-seed]%';

delete from public.client_contacts cc
using public.contacts ct, _demo_ctx c
where cc.contact_id = ct.id
  and ct.account_id = c.account_id
  and ct.notes ilike '%[ozer-demo-seed]%';

delete from public.contacts ct
using _demo_ctx c
where ct.account_id = c.account_id
  and ct.notes ilike '%[ozer-demo-seed]%';

delete from public.clients cl
using _demo_ctx c
where cl.account_id = c.account_id
  and (
    cl.email ilike '%@demo.ozer.seed'
    or cl.website = 'https://demo.ozer.seed'
  );

delete from public.commercial_listing_agents la
using _demo_ctx c
where la.account_id = c.account_id;

delete from public.commercial_workspace_teams t
using _demo_ctx c
where t.account_id = c.account_id
  and t.name in ('East Sussex', 'London');

-- Keep existing Kent team if present; only add missing demo team labels
insert into public.commercial_workspace_teams (id, account_id, name, sort_order)
select v.id, c.account_id, v.name, v.sort_order
from _demo_ctx c
cross join (
  values
    ('c0a10001-0001-4000-8000-000000000001'::uuid, 'Kent', 0),
    ('c0a10001-0001-4000-8000-000000000002'::uuid, 'East Sussex', 1),
    ('c0a10001-0001-4000-8000-000000000003'::uuid, 'London', 2)
) as v(id, name, sort_order)
where not exists (
  select 1
  from public.commercial_workspace_teams t
  where t.account_id = c.account_id
    and lower(trim(t.name)) = lower(v.name)
);

-- Prefer existing Kent row id if name already existed
create temporary table _demo_teams as
select
  c.account_id,
  (select id from public.commercial_workspace_teams t where t.account_id = c.account_id and lower(t.name) = 'kent' limit 1) as kent_id,
  (select id from public.commercial_workspace_teams t where t.account_id = c.account_id and lower(t.name) = 'east sussex' limit 1) as east_sussex_id,
  (select id from public.commercial_workspace_teams t where t.account_id = c.account_id and lower(t.name) = 'london' limit 1) as london_id
from _demo_ctx c;

-- Optional extra teammate for people screenshots (test@oodle.design)
insert into public.accounts_memberships (
  account_id, user_id, account_role, seat_kind, onboarding_completed, created_at, updated_at
)
select
  c.account_id,
  '2068d8b9-edce-4ae0-9257-22ff34420889'::uuid,
  'staff',
  'billable',
  true,
  now(),
  now()
from _demo_ctx c
where exists (
  select 1 from auth.users u where u.id = '2068d8b9-edce-4ae0-9257-22ff34420889'::uuid
)
on conflict (user_id, account_id) do update
set
  account_role = excluded.account_role,
  seat_kind = excluded.seat_kind,
  onboarding_completed = true,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Clients + contacts
-- ---------------------------------------------------------------------------
insert into public.clients (
  id, account_id, display_name, company_name, client_type, commercial_role,
  email, phone, city, postcode, country, website, created_by
)
select * from (
  values
    ('c0a10002-0001-4000-8000-000000000001'::uuid, (select account_id from _demo_ctx), 'Pantiles Estates', 'Pantiles Estates Ltd', 'business', 'landlord', 'reception@pantiles-estates.demo.ozer.seed', '01892 500001', 'Tunbridge Wells', 'TN1 1YJ', 'GB', 'https://demo.ozer.seed', (select owner_id from _demo_ctx)),
    ('c0a10002-0001-4000-8000-000000000002'::uuid, (select account_id from _demo_ctx), 'Weald Holdings', 'Weald Holdings PLC', 'business', 'landlord', 'asset@weald-holdings.demo.ozer.seed', '01892 500002', 'Tonbridge', 'TN9 1AG', 'GB', 'https://demo.ozer.seed', (select owner_id from _demo_ctx)),
    ('c0a10002-0001-4000-8000-000000000003'::uuid, (select account_id from _demo_ctx), 'South East Retail Co', 'South East Retail Co', 'business', 'tenant', 'property@seretail.demo.ozer.seed', '01892 500003', 'Maidstone', 'ME14 1LQ', 'GB', 'https://demo.ozer.seed', (select owner_id from _demo_ctx)),
    ('c0a10002-0001-4000-8000-000000000004'::uuid, (select account_id from _demo_ctx), 'Ashford Logistics', 'Ashford Logistics Ltd', 'business', 'tenant', 'ops@ashford-logistics.demo.ozer.seed', '01233 500004', 'Ashford', 'TN24 0HB', 'GB', 'https://demo.ozer.seed', (select owner_id from _demo_ctx)),
    ('c0a10002-0001-4000-8000-000000000005'::uuid, (select account_id from _demo_ctx), 'Kent Capital Partners', 'Kent Capital Partners', 'business', 'investor', 'deals@kentcapital.demo.ozer.seed', '020 7946 0005', 'London', 'EC2A 2BB', 'GB', 'https://demo.ozer.seed', (select owner_id from _demo_ctx)),
    ('c0a10002-0001-4000-8000-000000000006'::uuid, (select account_id from _demo_ctx), 'Buss Murton Law', 'Buss Murton LLP', 'business', 'solicitor', 'commercial@bussmurton.demo.ozer.seed', '01892 500006', 'Tunbridge Wells', 'TN1 1DQ', 'GB', 'https://demo.ozer.seed', (select owner_id from _demo_ctx)),
    ('c0a10002-0001-4000-8000-000000000007'::uuid, (select account_id from _demo_ctx), 'Clara Finch', null, 'individual', 'tenant', 'clara.finch@demo.ozer.seed', '07700 900007', 'Crowborough', 'TN6 1AB', 'GB', 'https://demo.ozer.seed', (select owner_id from _demo_ctx)),
    ('c0a10002-0001-4000-8000-000000000008'::uuid, (select account_id from _demo_ctx), 'Rotherfield Family Trust', 'Rotherfield Family Trust', 'business', 'landlord', 'trustees@rotherfield.demo.ozer.seed', '01892 500008', 'Rotherfield', 'TN6 3LL', 'GB', 'https://demo.ozer.seed', (select owner_id from _demo_ctx))
) as v(id, account_id, display_name, company_name, client_type, commercial_role, email, phone, city, postcode, country, website, created_by);

update public.clients
set
  first_name = case id
    when 'c0a10002-0001-4000-8000-000000000007'::uuid then 'Clara'
    else first_name
  end,
  last_name = case id
    when 'c0a10002-0001-4000-8000-000000000007'::uuid then 'Finch'
    else last_name
  end
where id = 'c0a10002-0001-4000-8000-000000000007'::uuid;

insert into public.contacts (
  id, account_id, full_name, first_name, last_name, email, phone, role, notes, is_primary
)
select * from (
  values
    ('c0a10003-0001-4000-8000-000000000001'::uuid, (select account_id from _demo_ctx), 'Helen Greaves', 'Helen', 'Greaves', 'helen.greaves@pantiles-estates.demo.ozer.seed', '01892 500011', 'Asset manager', '[ozer-demo-seed]', true),
    ('c0a10003-0001-4000-8000-000000000002'::uuid, (select account_id from _demo_ctx), 'Tom Ridley', 'Tom', 'Ridley', 'tom.ridley@weald-holdings.demo.ozer.seed', '01892 500012', 'Investment director', '[ozer-demo-seed]', true),
    ('c0a10003-0001-4000-8000-000000000003'::uuid, (select account_id from _demo_ctx), 'Priya Shah', 'Priya', 'Shah', 'priya.shah@seretail.demo.ozer.seed', '01892 500013', 'Head of property', '[ozer-demo-seed]', true),
    ('c0a10003-0001-4000-8000-000000000004'::uuid, (select account_id from _demo_ctx), 'Marcus Quinn', 'Marcus', 'Quinn', 'marcus.quinn@ashford-logistics.demo.ozer.seed', '01233 500014', 'Operations lead', '[ozer-demo-seed]', true),
    ('c0a10003-0001-4000-8000-000000000005'::uuid, (select account_id from _demo_ctx), 'Sophie Lang', 'Sophie', 'Lang', 'sophie.lang@kentcapital.demo.ozer.seed', '020 7946 0015', 'Acquisitions', '[ozer-demo-seed]', true),
    ('c0a10003-0001-4000-8000-000000000006'::uuid, (select account_id from _demo_ctx), 'James Pell', 'James', 'Pell', 'james.pell@bussmurton.demo.ozer.seed', '01892 500016', 'Partner', '[ozer-demo-seed]', true),
    ('c0a10003-0001-4000-8000-000000000007'::uuid, (select account_id from _demo_ctx), 'Clara Finch', 'Clara', 'Finch', 'clara.finch@demo.ozer.seed', '07700 900007', 'Occupier', '[ozer-demo-seed]', true),
    ('c0a10003-0001-4000-8000-000000000008'::uuid, (select account_id from _demo_ctx), 'Edward Shaw', 'Edward', 'Shaw', 'edward.shaw@rotherfield.demo.ozer.seed', '01892 500018', 'Trustee', '[ozer-demo-seed]', true),
    ('c0a10003-0001-4000-8000-000000000009'::uuid, (select account_id from _demo_ctx), 'Nina Okoro', 'Nina', 'Okoro', 'nina.okoro@seretail.demo.ozer.seed', '01892 500019', 'Store development', '[ozer-demo-seed]', false)
) as v(id, account_id, full_name, first_name, last_name, email, phone, role, notes, is_primary);

insert into public.client_contacts (client_id, contact_id, role, is_primary)
values
  ('c0a10002-0001-4000-8000-000000000001'::uuid, 'c0a10003-0001-4000-8000-000000000001'::uuid, 'Asset manager', true),
  ('c0a10002-0001-4000-8000-000000000002'::uuid, 'c0a10003-0001-4000-8000-000000000002'::uuid, 'Investment director', true),
  ('c0a10002-0001-4000-8000-000000000003'::uuid, 'c0a10003-0001-4000-8000-000000000003'::uuid, 'Head of property', true),
  ('c0a10002-0001-4000-8000-000000000003'::uuid, 'c0a10003-0001-4000-8000-000000000009'::uuid, 'Store development', false),
  ('c0a10002-0001-4000-8000-000000000004'::uuid, 'c0a10003-0001-4000-8000-000000000004'::uuid, 'Operations lead', true),
  ('c0a10002-0001-4000-8000-000000000005'::uuid, 'c0a10003-0001-4000-8000-000000000005'::uuid, 'Acquisitions', true),
  ('c0a10002-0001-4000-8000-000000000006'::uuid, 'c0a10003-0001-4000-8000-000000000006'::uuid, 'Partner', true),
  ('c0a10002-0001-4000-8000-000000000007'::uuid, 'c0a10003-0001-4000-8000-000000000007'::uuid, 'Occupier', true),
  ('c0a10002-0001-4000-8000-000000000008'::uuid, 'c0a10003-0001-4000-8000-000000000008'::uuid, 'Trustee', true);

insert into public.contact_email_addresses (account_id, contact_id, email, label, is_primary)
select c.account_id, ct.id, ct.email, 'work', true
from public.contacts ct
cross join _demo_ctx c
where ct.account_id = c.account_id
  and ct.notes ilike '%[ozer-demo-seed]%'
  and ct.email is not null;

-- ---------------------------------------------------------------------------
-- Enrich existing listings (statuses, teams, landlords, agents)
-- ---------------------------------------------------------------------------
with listing_map as (
  select * from (values
    ('00395431-ce10-451a-a16f-281fab19abf3'::uuid, 'for_sale', 'marketing', 'kent', 'c0a10002-0001-4000-8000-000000000008'::uuid),
    ('8905f0a6-a43a-4a5c-9e45-a894611bb42e'::uuid, 'to_let', 'under_offer', 'kent', 'c0a10002-0001-4000-8000-000000000001'::uuid),
    ('fdc548e5-e350-4f66-9945-79f5956ab709'::uuid, 'to_let', 'marketing', 'kent', 'c0a10002-0001-4000-8000-000000000002'::uuid),
    ('82f55ab8-b58d-46c1-9918-b5423fd4df6f'::uuid, 'for_sale', 'sold', 'kent', 'c0a10002-0001-4000-8000-000000000001'::uuid),
    ('f2463f6e-4fa4-4a70-9b73-d5b50b19363e'::uuid, 'to_let', 'marketing', 'kent', 'c0a10002-0001-4000-8000-000000000002'::uuid),
    ('ba5d5e30-fd6b-450e-9224-e93cd7594d53'::uuid, 'to_let', 'let', 'east', 'c0a10002-0001-4000-8000-000000000008'::uuid),
    ('edbd0fca-f65a-4dd1-b02d-1c92f6d49dd2'::uuid, 'for_sale', 'marketing', 'kent', 'c0a10002-0001-4000-8000-000000000001'::uuid),
    ('0cc194a0-bb84-434f-a4e7-506b4c2efdbb'::uuid, 'to_let', 'instructed', 'kent', 'c0a10002-0001-4000-8000-000000000002'::uuid),
    ('450e92aa-61a1-41aa-a58d-b1ff847e8a45'::uuid, 'to_let', 'under_offer', 'east', 'c0a10002-0001-4000-8000-000000000002'::uuid),
    ('d956c5f1-75c7-4149-a676-684b178fbcb5'::uuid, 'for_sale', 'marketing', 'london', 'c0a10002-0001-4000-8000-000000000005'::uuid)
  ) as x(listing_id, disposal_type, status, team_key, client_id)
)
update public.commercial_listings l
set
  status = m.status,
  instructing_client_id = m.client_id,
  assigned_to = (select owner_id from _demo_ctx),
  record_owner_user_id = (select owner_id from _demo_ctx),
  team_id = case m.team_key
    when 'kent' then (select kent_id from _demo_teams)
    when 'east' then (select east_sussex_id from _demo_teams)
    when 'london' then (select london_id from _demo_teams)
  end,
  terms_of_engagement = 'yes',
  off_market_at = case when m.status in ('let', 'sold') then now() - interval '12 days' else null end,
  updated_at = now()
from listing_map m
where l.id = m.listing_id
  and l.account_id = (select account_id from _demo_ctx);

insert into public.commercial_listing_agents (listing_id, account_id, user_id, sort_order)
select l.id, c.account_id, c.owner_id, 0
from public.commercial_listings l
cross join _demo_ctx c
where l.account_id = c.account_id
on conflict (listing_id, user_id) do nothing;

insert into public.commercial_listing_agents (listing_id, account_id, user_id, sort_order)
select l.id, c.account_id, '2068d8b9-edce-4ae0-9257-22ff34420889'::uuid, 1
from public.commercial_listings l
cross join _demo_ctx c
where l.account_id = c.account_id
  and l.id in (
    '8905f0a6-a43a-4a5c-9e45-a894611bb42e'::uuid,
    '450e92aa-61a1-41aa-a58d-b1ff847e8a45'::uuid,
    'fdc548e5-e350-4f66-9945-79f5956ab709'::uuid
  )
  and exists (select 1 from auth.users u where u.id = '2068d8b9-edce-4ae0-9257-22ff34420889'::uuid)
on conflict (listing_id, user_id) do nothing;

insert into public.commercial_listing_units (id, listing_id, account_id, label, floor_or_unit, size_sqft, sort_order)
values
  ('c0a10004-0001-4000-8000-000000000001'::uuid, '8905f0a6-a43a-4a5c-9e45-a894611bb42e'::uuid, (select account_id from _demo_ctx), 'Demo Ground floor', 'Ground', 1850, 0),
  ('c0a10004-0001-4000-8000-000000000002'::uuid, '8905f0a6-a43a-4a5c-9e45-a894611bb42e'::uuid, (select account_id from _demo_ctx), 'Demo First floor', 'First', 1200, 1),
  ('c0a10004-0001-4000-8000-000000000003'::uuid, 'f2463f6e-4fa4-4a70-9b73-d5b50b19363e'::uuid, (select account_id from _demo_ctx), 'Demo Warehouse bay', 'Unit 3', 4200, 0),
  ('c0a10004-0001-4000-8000-000000000004'::uuid, '0cc194a0-bb84-434f-a4e7-506b4c2efdbb'::uuid, (select account_id from _demo_ctx), 'Demo Workshop', 'Unit 13', 2100, 0);

-- ---------------------------------------------------------------------------
-- Requirements (demand side of WIP)
-- ---------------------------------------------------------------------------
insert into public.commercial_requirements (
  id, account_id, client_id, contact_name, contact_email, contact_phone, company_name,
  sector, tenure, location_text, size_min_sqft, size_max_sqft,
  budget_min_pence, budget_max_pence, stage, assigned_to, notes, source, created_by
)
values
  ('c0a10005-0001-4000-8000-000000000001'::uuid, (select account_id from _demo_ctx), 'c0a10002-0001-4000-8000-000000000003'::uuid, 'Priya Shah', 'priya.shah@seretail.demo.ozer.seed', '01892 500013', 'South East Retail Co', 'Retail', 'rent', 'Tunbridge Wells / Tonbridge', 800, 2500, 2000000, 5000000, 'actively_searching', (select owner_id from _demo_ctx), '[ozer-demo-seed] Seeking dual frontage high street unit.', 'ozer-demo-seed', (select owner_id from _demo_ctx)),
  ('c0a10005-0001-4000-8000-000000000002'::uuid, (select account_id from _demo_ctx), 'c0a10002-0001-4000-8000-000000000004'::uuid, 'Marcus Quinn', 'marcus.quinn@ashford-logistics.demo.ozer.seed', '01233 500014', 'Ashford Logistics Ltd', 'Industrial', 'rent', 'Tunbridge Wells industrial', 3000, 8000, 1000000, 3000000, 'under_offer_negotiating', (select owner_id from _demo_ctx), '[ozer-demo-seed] Yard access essential.', 'ozer-demo-seed', (select owner_id from _demo_ctx)),
  ('c0a10005-0001-4000-8000-000000000003'::uuid, (select account_id from _demo_ctx), 'c0a10002-0001-4000-8000-000000000005'::uuid, 'Sophie Lang', 'sophie.lang@kentcapital.demo.ozer.seed', '020 7946 0015', 'Kent Capital Partners', 'Investment', 'buy', 'Kent & East Sussex', 0, 20000, 150000000, 750000000, 'new', (select owner_id from _demo_ctx), '[ozer-demo-seed] Sub-8% NIY targets.', 'ozer-demo-seed', (select owner_id from _demo_ctx)),
  ('c0a10005-0001-4000-8000-000000000004'::uuid, (select account_id from _demo_ctx), 'c0a10002-0001-4000-8000-000000000007'::uuid, 'Clara Finch', 'clara.finch@demo.ozer.seed', '07700 900007', 'Clara Finch', 'Office', 'rent', 'Crowborough / Tunbridge Wells', 400, 1200, 1500000, 3500000, 'actively_searching', (select owner_id from _demo_ctx), '[ozer-demo-seed] Professional services suite.', 'ozer-demo-seed', (select owner_id from _demo_ctx)),
  ('c0a10005-0001-4000-8000-000000000005'::uuid, (select account_id from _demo_ctx), 'c0a10002-0001-4000-8000-000000000003'::uuid, 'Nina Okoro', 'nina.okoro@seretail.demo.ozer.seed', '01892 500019', 'South East Retail Co', 'Retail', 'rent', 'Pantiles / High Street', 600, 1500, 2500000, 4500000, 'fulfilled', (select owner_id from _demo_ctx), '[ozer-demo-seed] Completed take-up last quarter.', 'ozer-demo-seed', (select owner_id from _demo_ctx)),
  ('c0a10005-0001-4000-8000-000000000006'::uuid, (select account_id from _demo_ctx), null, 'Alex Ng', 'alex.ng@demo.ozer.seed', '07700 900066', 'Bright Forge Studio', 'Office', 'both', 'Sevenoaks / Tunbridge Wells', 1000, 3000, 2000000, 6000000, 'new', (select owner_id from _demo_ctx), '[ozer-demo-seed] Unassigned inbound requirement.', 'ozer-demo-seed', (select owner_id from _demo_ctx)),
  ('c0a10005-0001-4000-8000-000000000007'::uuid, (select account_id from _demo_ctx), 'c0a10002-0001-4000-8000-000000000004'::uuid, 'Marcus Quinn', 'marcus.quinn@ashford-logistics.demo.ozer.seed', '01233 500014', 'Ashford Logistics Ltd', 'Industrial', 'buy', 'M20 corridor', 10000, 40000, 200000000, 600000000, 'withdrawn', (select owner_id from _demo_ctx), '[ozer-demo-seed] Budget reallocated.', 'ozer-demo-seed', (select owner_id from _demo_ctx)),
  ('c0a10005-0001-4000-8000-000000000008'::uuid, (select account_id from _demo_ctx), 'c0a10002-0001-4000-8000-000000000005'::uuid, 'Sophie Lang', 'sophie.lang@kentcapital.demo.ozer.seed', '020 7946 0015', 'Kent Capital Partners', 'Mixed', 'buy', 'Tunbridge Wells town centre', 2000, 8000, 100000000, 350000000, 'actively_searching', (select owner_id from _demo_ctx), '[ozer-demo-seed] Value-add offices.', 'ozer-demo-seed', (select owner_id from _demo_ctx));

-- ---------------------------------------------------------------------------
-- WIP instructions (pipeline_deals)
-- ---------------------------------------------------------------------------
insert into public.pipeline_deals (
  id, account_id, name, stage, source, value, company_name, contact_name, contact_email, contact_phone,
  client_id, commercial_listing_id, commercial_requirement_id, next_action, next_action_date, notes,
  probability, expected_close, hots_rent_psf, hots_size_sqft, hots_lease_years, hots_solicitor_name,
  hots_target_exchange_date, hots_notes, completed_at, created_at, updated_at
)
values
  ('c0a10006-0001-4000-8000-000000000001'::uuid, (select account_id from _demo_ctx), 'Weald Holdings — Unit 3 Tonbridge', 'potential', 'other', 27000, 'Weald Holdings PLC', 'Tom Ridley', 'tom.ridley@weald-holdings.demo.ozer.seed', '01892 500012', 'c0a10002-0001-4000-8000-000000000002'::uuid, 'fdc548e5-e350-4f66-9945-79f5956ab709'::uuid, null, 'Issue draft particulars', (current_date + 3), '[ozer-demo-seed]', 20, (current_date + 60), null, null, null, null, null, null, null, now() - interval '18 days', now()),
  ('c0a10006-0001-4000-8000-000000000002'::uuid, (select account_id from _demo_ctx), 'Pantiles Estates — Mount Pleasant Road', 'current', 'other', 40000, 'Pantiles Estates Ltd', 'Helen Greaves', 'helen.greaves@pantiles-estates.demo.ozer.seed', '01892 500011', 'c0a10002-0001-4000-8000-000000000001'::uuid, '8905f0a6-a43a-4a5c-9e45-a894611bb42e'::uuid, 'c0a10005-0001-4000-8000-000000000001'::uuid, 'Chase solicitor pack', (current_date + 2), '[ozer-demo-seed]', 55, (current_date + 35), 28.5, 3050, 10, 'James Pell', (current_date + 28), '[ozer-demo-seed] HoTs issued', null, now() - interval '40 days', now()),
  ('c0a10006-0001-4000-8000-000000000003'::uuid, (select account_id from _demo_ctx), 'Ashford Logistics — Colebrook Unit 3', 'under_offer_negotiating', 'other', 18000, 'Ashford Logistics Ltd', 'Marcus Quinn', 'marcus.quinn@ashford-logistics.demo.ozer.seed', '01233 500014', 'c0a10002-0001-4000-8000-000000000004'::uuid, 'f2463f6e-4fa4-4a70-9b73-d5b50b19363e'::uuid, 'c0a10005-0001-4000-8000-000000000002'::uuid, 'Agree rent-free', (current_date + 1), '[ozer-demo-seed]', 70, (current_date + 21), 12.0, 4200, 5, 'James Pell', (current_date + 18), '[ozer-demo-seed] Competing bidder', null, now() - interval '25 days', now()),
  ('c0a10006-0001-4000-8000-000000000004'::uuid, (select account_id from _demo_ctx), 'Rotherfield Trust — Petts Cottage', 'current', 'other', 500000, 'Rotherfield Family Trust', 'Edward Shaw', 'edward.shaw@rotherfield.demo.ozer.seed', '01892 500018', 'c0a10002-0001-4000-8000-000000000008'::uuid, '00395431-ce10-451a-a16f-281fab19abf3'::uuid, null, 'Book valuation inspection', (current_date + 5), '[ozer-demo-seed]', 40, (current_date + 75), null, null, null, null, null, null, null, now() - interval '12 days', now()),
  ('c0a10006-0001-4000-8000-000000000005'::uuid, (select account_id from _demo_ctx), 'Pantiles Estates — Calverley Road (sold)', 'completed_exchanged', 'other', 750000, 'Pantiles Estates Ltd', 'Helen Greaves', 'helen.greaves@pantiles-estates.demo.ozer.seed', '01892 500011', 'c0a10002-0001-4000-8000-000000000001'::uuid, '82f55ab8-b58d-46c1-9918-b5423fd4df6f'::uuid, null, null, null, '[ozer-demo-seed]', 100, (current_date - 10), null, null, null, 'James Pell', (current_date - 20), '[ozer-demo-seed] Exchanged & completed', now() - interval '10 days', now() - interval '90 days', now()),
  ('c0a10006-0001-4000-8000-000000000006'::uuid, (select account_id from _demo_ctx), 'Weald Holdings — Old Post Office let', 'completed_exchanged', 'other', 8500, 'Weald Holdings PLC', 'Tom Ridley', 'tom.ridley@weald-holdings.demo.ozer.seed', '01892 500012', 'c0a10002-0001-4000-8000-000000000002'::uuid, 'ba5d5e30-fd6b-450e-9224-e93cd7594d53'::uuid, 'c0a10005-0001-4000-8000-000000000005'::uuid, null, null, '[ozer-demo-seed]', 100, (current_date - 20), 18.0, 950, 7, 'James Pell', (current_date - 30), '[ozer-demo-seed]', now() - interval '20 days', now() - interval '110 days', now()),
  ('c0a10006-0001-4000-8000-000000000007'::uuid, (select account_id from _demo_ctx), 'Bright Forge — Pantiles office (fallen)', 'fallen_through', 'other', 230000, 'Bright Forge Studio', 'Alex Ng', 'alex.ng@demo.ozer.seed', '07700 900066', null, 'edbd0fca-f65a-4dd1-b02d-1c92f6d49dd2'::uuid, 'c0a10005-0001-4000-8000-000000000006'::uuid, null, null, '[ozer-demo-seed] Funding failed.', 0, null, null, null, null, null, null, null, null, now() - interval '55 days', now()),
  ('c0a10006-0001-4000-8000-000000000008'::uuid, (select account_id from _demo_ctx), 'Kent Capital — Speldhurst park', 'potential', 'referral', 180000, 'Kent Capital Partners', 'Sophie Lang', 'sophie.lang@kentcapital.demo.ozer.seed', '020 7946 0015', 'c0a10002-0001-4000-8000-000000000005'::uuid, 'd956c5f1-75c7-4149-a676-684b178fbcb5'::uuid, 'c0a10005-0001-4000-8000-000000000008'::uuid, 'Send investment memo', (current_date + 4), '[ozer-demo-seed]', 25, (current_date + 90), null, null, null, null, null, null, null, now() - interval '6 days', now()),
  ('c0a10006-0001-4000-8000-000000000009'::uuid, (select account_id from _demo_ctx), 'Clara Finch — Colebrook workshop', 'current', 'website', 9000, 'Clara Finch', 'Clara Finch', 'clara.finch@demo.ozer.seed', '07700 900007', 'c0a10002-0001-4000-8000-000000000007'::uuid, '0cc194a0-bb84-434f-a4e7-506b4c2efdbb'::uuid, 'c0a10005-0001-4000-8000-000000000004'::uuid, 'Confirm viewing 2', (current_date + 2), '[ozer-demo-seed]', 45, (current_date + 40), 9.5, 2100, 3, null, null, null, null, now() - interval '9 days', now());

-- Keep existing Steve Jobs deal (not tagged) — it already shows under offer

-- ---------------------------------------------------------------------------
-- Matches, enquiries, viewings, leases
-- ---------------------------------------------------------------------------
insert into public.commercial_matches (
  id, account_id, listing_id, requirement_id, status, notes, created_by
)
values
  ('c0a10007-0001-4000-8000-000000000001'::uuid, (select account_id from _demo_ctx), '8905f0a6-a43a-4a5c-9e45-a894611bb42e'::uuid, 'c0a10005-0001-4000-8000-000000000001'::uuid, 'negotiating', '[ozer-demo-seed]', (select owner_id from _demo_ctx)),
  ('c0a10007-0001-4000-8000-000000000002'::uuid, (select account_id from _demo_ctx), 'f2463f6e-4fa4-4a70-9b73-d5b50b19363e'::uuid, 'c0a10005-0001-4000-8000-000000000002'::uuid, 'under_offer', '[ozer-demo-seed]', (select owner_id from _demo_ctx)),
  ('c0a10007-0001-4000-8000-000000000003'::uuid, (select account_id from _demo_ctx), 'ba5d5e30-fd6b-450e-9224-e93cd7594d53'::uuid, 'c0a10005-0001-4000-8000-000000000005'::uuid, 'signed', '[ozer-demo-seed]', (select owner_id from _demo_ctx)),
  ('c0a10007-0001-4000-8000-000000000004'::uuid, (select account_id from _demo_ctx), '0cc194a0-bb84-434f-a4e7-506b4c2efdbb'::uuid, 'c0a10005-0001-4000-8000-000000000004'::uuid, 'viewing', '[ozer-demo-seed]', (select owner_id from _demo_ctx)),
  ('c0a10007-0001-4000-8000-000000000005'::uuid, (select account_id from _demo_ctx), 'edbd0fca-f65a-4dd1-b02d-1c92f6d49dd2'::uuid, 'c0a10005-0001-4000-8000-000000000006'::uuid, 'discounted', '[ozer-demo-seed]', (select owner_id from _demo_ctx)),
  ('c0a10007-0001-4000-8000-000000000006'::uuid, (select account_id from _demo_ctx), 'fdc548e5-e350-4f66-9945-79f5956ab709'::uuid, 'c0a10005-0001-4000-8000-000000000001'::uuid, 'shortlisted', '[ozer-demo-seed]', (select owner_id from _demo_ctx));

insert into public.commercial_enquiries (
  id, account_id, listing_id, requirement_id, match_id, source, status,
  contact_name, contact_email, contact_phone, message, received_at, external_ref
)
values
  ('c0a10008-0001-4000-8000-000000000001'::uuid, (select account_id from _demo_ctx), '8905f0a6-a43a-4a5c-9e45-a894611bb42e'::uuid, 'c0a10005-0001-4000-8000-000000000001'::uuid, 'c0a10007-0001-4000-8000-000000000001'::uuid, 'website', 'on_schedule', 'Priya Shah', 'priya.shah@seretail.demo.ozer.seed', '01892 500013', '[ozer-demo-seed] Interested in Mount Pleasant for a new concept store.', now() - interval '14 days', 'ozer-demo-enq-001'),
  ('c0a10008-0001-4000-8000-000000000002'::uuid, (select account_id from _demo_ctx), 'f2463f6e-4fa4-4a70-9b73-d5b50b19363e'::uuid, 'c0a10005-0001-4000-8000-000000000002'::uuid, 'c0a10007-0001-4000-8000-000000000002'::uuid, 'rightmove', 'on_schedule', 'Marcus Quinn', 'marcus.quinn@ashford-logistics.demo.ozer.seed', '01233 500014', '[ozer-demo-seed] Can you confirm eaves height and yard depth?', now() - interval '9 days', 'ozer-demo-enq-002'),
  ('c0a10008-0001-4000-8000-000000000003'::uuid, (select account_id from _demo_ctx), '0cc194a0-bb84-434f-a4e7-506b4c2efdbb'::uuid, 'c0a10005-0001-4000-8000-000000000004'::uuid, 'c0a10007-0001-4000-8000-000000000004'::uuid, 'manual', 'unactioned', 'Clara Finch', 'clara.finch@demo.ozer.seed', '07700 900007', '[ozer-demo-seed] Looking for a bright workshop with parking.', now() - interval '2 days', 'ozer-demo-enq-003'),
  ('c0a10008-0001-4000-8000-000000000004'::uuid, (select account_id from _demo_ctx), 'edbd0fca-f65a-4dd1-b02d-1c92f6d49dd2'::uuid, null, null, 'each', 'archived', 'Alex Ng', 'alex.ng@demo.ozer.seed', '07700 900066', '[ozer-demo-seed] Withdrawn after inspection.', now() - interval '45 days', 'ozer-demo-enq-004'),
  ('c0a10008-0001-4000-8000-000000000005'::uuid, (select account_id from _demo_ctx), 'fdc548e5-e350-4f66-9945-79f5956ab709'::uuid, 'c0a10005-0001-4000-8000-000000000001'::uuid, 'c0a10007-0001-4000-8000-000000000006'::uuid, 'website', 'unactioned', 'Priya Shah', 'priya.shah@seretail.demo.ozer.seed', '01892 500013', '[ozer-demo-seed] Also considering Tonbridge as a second shortlist.', now() - interval '1 day', 'ozer-demo-enq-005'),
  ('c0a10008-0001-4000-8000-000000000006'::uuid, (select account_id from _demo_ctx), '00395431-ce10-451a-a16f-281fab19abf3'::uuid, 'c0a10005-0001-4000-8000-000000000003'::uuid, null, 'manual', 'on_schedule', 'Sophie Lang', 'sophie.lang@kentcapital.demo.ozer.seed', '020 7946 0015', '[ozer-demo-seed] Please share tenancy schedule.', now() - interval '6 days', 'ozer-demo-enq-006'),
  ('c0a10008-0001-4000-8000-000000000007'::uuid, (select account_id from _demo_ctx), 'd956c5f1-75c7-4149-a676-684b178fbcb5'::uuid, 'c0a10005-0001-4000-8000-000000000008'::uuid, null, 'rightmove', 'unactioned', 'Sophie Lang', 'sophie.lang@kentcapital.demo.ozer.seed', '020 7946 0015', '[ozer-demo-seed] Requesting brochure and EPC.', now() - interval '3 days', 'ozer-demo-enq-007');

insert into public.commercial_viewings (
  id, account_id, listing_id, enquiry_id, requirement_id, client_id,
  scheduled_at, conducted_by, outcome, feedback, status, created_by
)
values
  ('c0a10009-0001-4000-8000-000000000001'::uuid, (select account_id from _demo_ctx), '8905f0a6-a43a-4a5c-9e45-a894611bb42e'::uuid, 'c0a10008-0001-4000-8000-000000000001'::uuid, 'c0a10005-0001-4000-8000-000000000001'::uuid, 'c0a10002-0001-4000-8000-000000000003'::uuid, now() + interval '2 days', (select owner_id from _demo_ctx), null, null, 'upcoming', (select owner_id from _demo_ctx)),
  ('c0a10009-0001-4000-8000-000000000002'::uuid, (select account_id from _demo_ctx), 'f2463f6e-4fa4-4a70-9b73-d5b50b19363e'::uuid, 'c0a10008-0001-4000-8000-000000000002'::uuid, 'c0a10005-0001-4000-8000-000000000002'::uuid, 'c0a10002-0001-4000-8000-000000000004'::uuid, now() + interval '5 days', (select owner_id from _demo_ctx), null, null, 'upcoming', (select owner_id from _demo_ctx)),
  ('c0a10009-0001-4000-8000-000000000003'::uuid, (select account_id from _demo_ctx), '0cc194a0-bb84-434f-a4e7-506b4c2efdbb'::uuid, 'c0a10008-0001-4000-8000-000000000003'::uuid, 'c0a10005-0001-4000-8000-000000000004'::uuid, 'c0a10002-0001-4000-8000-000000000007'::uuid, now() + interval '1 day', '2068d8b9-edce-4ae0-9257-22ff34420889'::uuid, null, null, 'upcoming', (select owner_id from _demo_ctx)),
  ('c0a10009-0001-4000-8000-000000000004'::uuid, (select account_id from _demo_ctx), '8905f0a6-a43a-4a5c-9e45-a894611bb42e'::uuid, 'c0a10008-0001-4000-8000-000000000001'::uuid, 'c0a10005-0001-4000-8000-000000000001'::uuid, 'c0a10002-0001-4000-8000-000000000003'::uuid, now() - interval '8 days', (select owner_id from _demo_ctx), 'positive', '[ozer-demo-seed] Liked frontage; concerned about fit-out timing.', 'completed', (select owner_id from _demo_ctx)),
  ('c0a10009-0001-4000-8000-000000000005'::uuid, (select account_id from _demo_ctx), 'f2463f6e-4fa4-4a70-9b73-d5b50b19363e'::uuid, 'c0a10008-0001-4000-8000-000000000002'::uuid, 'c0a10005-0001-4000-8000-000000000002'::uuid, 'c0a10002-0001-4000-8000-000000000004'::uuid, now() - interval '16 days', (select owner_id from _demo_ctx), 'neutral', '[ozer-demo-seed] Yard works — reinspect after resurfacing.', 'awaiting_feedback', (select owner_id from _demo_ctx)),
  ('c0a10009-0001-4000-8000-000000000006'::uuid, (select account_id from _demo_ctx), 'ba5d5e30-fd6b-450e-9224-e93cd7594d53'::uuid, null, 'c0a10005-0001-4000-8000-000000000005'::uuid, 'c0a10002-0001-4000-8000-000000000003'::uuid, now() - interval '35 days', (select owner_id from _demo_ctx), 'positive', '[ozer-demo-seed] Proceeded to HoTs.', 'completed', (select owner_id from _demo_ctx)),
  ('c0a10009-0001-4000-8000-000000000007'::uuid, (select account_id from _demo_ctx), 'edbd0fca-f65a-4dd1-b02d-1c92f6d49dd2'::uuid, 'c0a10008-0001-4000-8000-000000000004'::uuid, 'c0a10005-0001-4000-8000-000000000006'::uuid, null, now() - interval '50 days', (select owner_id from _demo_ctx), 'negative', '[ozer-demo-seed] Layout too fragmented.', 'completed', (select owner_id from _demo_ctx)),
  ('c0a10009-0001-4000-8000-000000000008'::uuid, (select account_id from _demo_ctx), 'fdc548e5-e350-4f66-9945-79f5956ab709'::uuid, 'c0a10008-0001-4000-8000-000000000005'::uuid, 'c0a10005-0001-4000-8000-000000000001'::uuid, 'c0a10002-0001-4000-8000-000000000003'::uuid, now() + interval '8 days', (select owner_id from _demo_ctx), null, null, 'upcoming', (select owner_id from _demo_ctx)),
  ('c0a10009-0001-4000-8000-000000000009'::uuid, (select account_id from _demo_ctx), '00395431-ce10-451a-a16f-281fab19abf3'::uuid, 'c0a10008-0001-4000-8000-000000000006'::uuid, 'c0a10005-0001-4000-8000-000000000003'::uuid, 'c0a10002-0001-4000-8000-000000000005'::uuid, now() - interval '4 days', (select owner_id from _demo_ctx), 'positive', '[ozer-demo-seed] Strong income angle.', 'completed', (select owner_id from _demo_ctx)),
  ('c0a10009-0001-4000-8000-00000000000a'::uuid, (select account_id from _demo_ctx), 'd956c5f1-75c7-4149-a676-684b178fbcb5'::uuid, 'c0a10008-0001-4000-8000-000000000007'::uuid, 'c0a10005-0001-4000-8000-000000000008'::uuid, 'c0a10002-0001-4000-8000-000000000005'::uuid, now() + interval '11 days', '2068d8b9-edce-4ae0-9257-22ff34420889'::uuid, null, null, 'upcoming', (select owner_id from _demo_ctx)),
  ('c0a10009-0001-4000-8000-00000000000b'::uuid, (select account_id from _demo_ctx), '450e92aa-61a1-41aa-a58d-b1ff847e8a45'::uuid, null, null, null, now() - interval '3 days', (select owner_id from _demo_ctx), null, '[ozer-demo-seed] With Steve Jobs deal — awaiting feedback.', 'awaiting_feedback', (select owner_id from _demo_ctx)),
  ('c0a10009-0001-4000-8000-00000000000c'::uuid, (select account_id from _demo_ctx), '82f55ab8-b58d-46c1-9918-b5423fd4df6f'::uuid, null, null, 'c0a10002-0001-4000-8000-000000000001'::uuid, now() - interval '70 days', (select owner_id from _demo_ctx), 'positive', '[ozer-demo-seed] Pre-sale investor tour.', 'completed', (select owner_id from _demo_ctx));

insert into public.commercial_leases (
  id, account_id, listing_id, client_id, property_label, town, postcode,
  tenant_name, headline_rent_psf, lease_start, lease_end, status, notes, created_by
)
values
  ('c0a1000a-0001-4000-8000-000000000001'::uuid, (select account_id from _demo_ctx), 'ba5d5e30-fd6b-450e-9224-e93cd7594d53'::uuid, 'c0a10002-0001-4000-8000-000000000003'::uuid, 'The Old Post Office, Hawkhurst', 'Hawkhurst', 'TN18 4AA', 'South East Retail Co', 18.0, current_date - 20, current_date + interval '7 years', 'active', '[ozer-demo-seed]', (select owner_id from _demo_ctx)),
  ('c0a1000a-0001-4000-8000-000000000002'::uuid, (select account_id from _demo_ctx), '82f55ab8-b58d-46c1-9918-b5423fd4df6f'::uuid, null, '71 Calverley Road (historic tenancy)', 'Tunbridge Wells', 'TN1 2UY', 'Historic tenant', 22.0, current_date - interval '4 years', current_date - 40, 'expired', '[ozer-demo-seed]', (select owner_id from _demo_ctx));

-- Ensure WIP board name
insert into public.pipeline_board_stage_settings (account_id, board_name, stages, updated_at)
select c.account_id, 'WIP', '[]'::jsonb, now()
from _demo_ctx c
on conflict (account_id) do update
set
  board_name = coalesce(nullif(public.pipeline_board_stage_settings.board_name, ''), 'WIP'),
  updated_at = now();

commit;
