-- Add url_path match type for activity assignment rules.

ALTER TABLE public.activity_rules
  DROP CONSTRAINT IF EXISTS activity_rules_match_type_check;

ALTER TABLE public.activity_rules
  ADD CONSTRAINT activity_rules_match_type_check CHECK (
    match_type IN ('domain', 'app_name', 'title_contains', 'url_path')
  );

CREATE OR REPLACE FUNCTION public.normalize_activity_url(url text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN url IS NULL OR btrim(url) = '' THEN NULL
    ELSE lower(
      regexp_replace(
        regexp_replace(
          regexp_replace(btrim(url), '^https?://', '', 'i'),
          '^www\.', '', 'i'
        ),
        '/$', '', 'g'
      )
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.apply_activity_block_rule()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  matched_rule record;
  normalized_url text;
BEGIN
  IF NEW.is_confirmed = true THEN
    RETURN NEW;
  END IF;

  normalized_url := public.normalize_activity_url(NEW.url);

  SELECT
    r.project_id,
    r.client_id
  INTO matched_rule
  FROM public.activity_rules r
  WHERE r.account_id = NEW.account_id
    AND r.user_id = NEW.user_id
    AND (
      (
        r.match_type = 'domain'
        AND NEW.domain IS NOT NULL
        AND (
          lower(NEW.domain) = lower(r.match_value)
          OR lower(NEW.domain) LIKE ('%.' || lower(r.match_value))
        )
      )
      OR (
        r.match_type = 'app_name'
        AND lower(NEW.app_name) = lower(r.match_value)
      )
      OR (
        r.match_type = 'title_contains'
        AND NEW.window_title IS NOT NULL
        AND NEW.window_title ILIKE ('%' || r.match_value || '%')
      )
      OR (
        r.match_type = 'url_path'
        AND normalized_url IS NOT NULL
        AND (
          normalized_url = lower(r.match_value)
          OR normalized_url LIKE (lower(r.match_value) || '/%')
        )
      )
    )
  ORDER BY
    CASE r.match_type
      WHEN 'title_contains' THEN 0
      WHEN 'url_path' THEN 1
      WHEN 'domain' THEN 2
      WHEN 'app_name' THEN 3
      ELSE 4
    END,
    CASE r.created_from WHEN 'manual' THEN 0 ELSE 1 END,
    r.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF matched_rule.project_id IS NOT NULL THEN
    NEW.project_id := matched_rule.project_id;
  END IF;

  IF matched_rule.client_id IS NOT NULL THEN
    NEW.client_id := matched_rule.client_id;
  END IF;

  IF matched_rule.project_id IS NOT NULL OR matched_rule.client_id IS NOT NULL THEN
    NEW.is_confirmed := true;
  END IF;

  RETURN NEW;
END;
$$;
