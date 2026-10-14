-- Ice Breakers and persistent menu as last pushed to Meta, so the settings
-- panel can show and edit them. Shape:
-- { ice_breakers: [{ question, trigger_id }],
--   persistent_menu: [{ type: 'postback', title, trigger_id } | { type: 'web_url', title, url }],
--   synced_at }

ALTER TABLE public.ig_connected_accounts
  ADD COLUMN IF NOT EXISTS messenger_profile jsonb NOT NULL DEFAULT '{}'::jsonb;
