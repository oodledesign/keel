-- Repair established workspaces after admin grants: skip /setup bounce and align lite → full business.
-- Version bumped from 20260612120000 (conflicted with create_video_hosting).

UPDATE public.accounts_memberships am
SET onboarding_completed = true
WHERE am.onboarding_completed = false
  AND EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE b.account_id = am.account_id
  )
  AND (
    EXISTS (
      SELECT 1
      FROM public.account_entitlements ae
      WHERE ae.account_id = am.account_id
        AND ae.entitlement_key IN (
          'workspace_business',
          'workspace_business_lite',
          'workspace_property',
          'workspace_community',
          'addon_signatures',
          'addon_rankly',
          'addon_feedflow',
          'addon_videos'
        )
        AND (ae.expires_at IS NULL OR ae.expires_at > now())
    )
    OR EXISTS (
      SELECT 1
      FROM public.account_billing_exempt abe
      WHERE abe.account_id = am.account_id
    )
  );

UPDATE public.businesses b
SET type = 'other'
WHERE b.type = 'lite'
  AND EXISTS (
    SELECT 1
    FROM public.account_entitlements ae
    WHERE ae.account_id = b.account_id
      AND ae.entitlement_key = 'workspace_business'
      AND (ae.expires_at IS NULL OR ae.expires_at > now())
  );

NOTIFY pgrst, 'reload schema';
