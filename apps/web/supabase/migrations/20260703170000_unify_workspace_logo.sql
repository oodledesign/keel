-- Unify workspace logo: sidebar avatar (accounts.picture_url) and brand templates (logo_url).

UPDATE public.accounts a
SET picture_url = abs.logo_url
FROM public.account_brand_settings abs
WHERE abs.account_id = a.id
  AND abs.logo_url IS NOT NULL
  AND coalesce(a.picture_url, '') = '';

UPDATE public.account_brand_settings abs
SET logo_url = a.picture_url
FROM public.accounts a
WHERE a.id = abs.account_id
  AND abs.logo_url IS NULL
  AND a.picture_url IS NOT NULL;

INSERT INTO public.account_brand_settings (account_id, logo_url)
SELECT a.id, a.picture_url
FROM public.accounts a
LEFT JOIN public.account_brand_settings abs ON abs.account_id = a.id
WHERE abs.account_id IS NULL
  AND a.picture_url IS NOT NULL
  AND a.is_personal_account = false
ON CONFLICT (account_id) DO NOTHING;

UPDATE public.agency_branding ab
SET logo_url = coalesce(a.picture_url, abs.logo_url)
FROM public.accounts a
LEFT JOIN public.account_brand_settings abs ON abs.account_id = a.id
WHERE ab.business_id = a.id
  AND ab.logo_url IS NULL
  AND coalesce(a.picture_url, abs.logo_url) IS NOT NULL;

NOTIFY pgrst, 'reload schema';
