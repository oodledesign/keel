-- Makerkit expects a single row in public.config. Duplicate rows break
-- PostgREST .single() lookups (e.g. billing gateway provider resolution).
delete from public.config
where ctid not in (
  select min(ctid)
  from public.config
);
