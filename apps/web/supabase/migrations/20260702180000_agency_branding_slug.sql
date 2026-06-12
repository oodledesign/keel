-- Agency portal subdomain routing: unique slug per business branding record.

ALTER TABLE public.agency_branding
ADD COLUMN IF NOT EXISTS slug text UNIQUE;

CREATE INDEX IF NOT EXISTS agency_branding_slug_idx ON public.agency_branding (slug);
