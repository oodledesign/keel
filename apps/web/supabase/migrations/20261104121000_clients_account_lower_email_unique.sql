-- Optional uniqueness for CRM upsert-by-email. Skip if duplicate emails exist.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.clients
    WHERE email IS NOT NULL
      AND btrim(email) <> ''
    GROUP BY account_id, lower(email)
    HAVING count(*) > 1
  ) THEN
    RAISE NOTICE
      'Skipping clients (account_id, lower(email)) unique index — duplicate emails exist';
    RETURN;
  END IF;

  CREATE UNIQUE INDEX IF NOT EXISTS clients_account_lower_email_uidx
    ON public.clients (account_id, lower(email))
    WHERE email IS NOT NULL AND btrim(email) <> '';
END
$$;
