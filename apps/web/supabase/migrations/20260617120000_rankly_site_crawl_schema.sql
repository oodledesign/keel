-- Structured data (JSON-LD) captured per crawled page

alter table rankly.site_crawl_pages
  add column if not exists schema_types jsonb not null default '[]'::jsonb,
  add column if not exists schema_objects jsonb not null default '[]'::jsonb;

comment on column rankly.site_crawl_pages.schema_types is
  'Unique @type values from JSON-LD on the page (e.g. Organization, WebPage)';
comment on column rankly.site_crawl_pages.schema_objects is
  'Full parsed JSON-LD objects from application/ld+json script tags';
