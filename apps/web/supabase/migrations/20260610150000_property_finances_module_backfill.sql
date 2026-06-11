-- Ensure property workspaces have the finances module enabled (nav + dashboard entry).

INSERT INTO public.account_module_settings (account_id, module_key, enabled)
SELECT DISTINCT a.id, 'finances', true
FROM public.accounts a
LEFT JOIN public.businesses b ON b.account_id = a.id
WHERE coalesce(a.space_type, 'work') = 'property'
   OR (
     coalesce(a.space_type, 'work') = 'work'
     AND lower(coalesce(b.type, '')) = 'property'
   )
ON CONFLICT (account_id, module_key) DO NOTHING;
