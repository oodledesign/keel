-- Instagram Business Login does not use a Facebook Page.
ALTER TABLE public.ig_connected_accounts
  ALTER COLUMN facebook_page_id DROP NOT NULL;
