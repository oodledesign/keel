-- Replace legacy em-dash take dividers in survey_observations with blank lines.
-- survey_observations is building-surveyor only; safe for other workspaces.

UPDATE public.survey_observations
SET
  body = trim(
    both E'\n'
    from regexp_replace(
      body,
      E'\\s*————\\s*',
      E'\n\n',
      'g'
    )
  ),
  source_body = CASE
    WHEN source_body IS NULL THEN NULL
    ELSE trim(
      both E'\n'
      from regexp_replace(
        source_body,
        E'\\s*————\\s*',
        E'\n\n',
        'g'
      )
    )
  END
WHERE
  body LIKE '%————%'
  OR source_body LIKE '%————%';
