-- Ahrefs Domain Rating (free public API) alongside Open PageRank.
-- License: http://ahrefs.com/legal/domain-rating-license
-- Attribution required in UI: "Domain Rating by Ahrefs"

alter table rankly.ai_audit_reports
  add column if not exists ahrefs_dr numeric(5, 1);

comment on column rankly.ai_audit_reports.ahrefs_dr is
  'Ahrefs Domain Rating (0–100) for target domain at audit time. Attribution: Domain Rating by Ahrefs.';

alter table rankly.site_overviews
  add column if not exists ahrefs_dr numeric(5, 1);

comment on column rankly.site_overviews.ahrefs_dr is
  'Ahrefs Domain Rating (0–100) from free public API. Attribution: Domain Rating by Ahrefs.';

notify pgrst, 'reload schema';
