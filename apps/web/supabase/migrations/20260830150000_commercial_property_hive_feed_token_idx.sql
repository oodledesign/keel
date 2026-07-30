-- Speed up Property Hive XML feed token lookups.

CREATE INDEX IF NOT EXISTS commercial_portal_credentials_ph_feed_token_idx
  ON public.commercial_portal_credentials ((metadata ->> 'xml_feed_token'))
  WHERE portal = 'property_hive'
    AND metadata ->> 'xml_feed_token' IS NOT NULL;
