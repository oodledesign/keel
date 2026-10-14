-- Instagram Automation v2 backfill: map legacy trigger fields onto the new
-- columns and convert existing static / interactive DMs into step sequences.
-- Legacy columns are left in place; the sender falls back to them for triggers
-- without steps (e.g. AI-generated DMs).

UPDATE public.ig_triggers
SET match_mode = 'exact'
WHERE match_type = 'exact' AND match_mode = 'contains';

UPDATE public.ig_triggers
SET media_scope = 'specific_post'
WHERE scope = 'specific_posts' AND media_scope = 'any_post';

-- Interactive dm_flow → one buttons step per flow step.
INSERT INTO public.ig_automation_steps (account_id, trigger_id, position, step_type, config)
SELECT
  t.account_id,
  t.id,
  (s.ordinality - 1)::integer,
  'buttons',
  jsonb_build_object(
    'text', s.step ->> 'message',
    'buttons', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_strip_nulls(
            jsonb_build_object(
              'label', b ->> 'label',
              'type', b ->> 'type',
              'url', b ->> 'url'
            )
          )
        )
        FROM jsonb_array_elements(s.step -> 'buttons') AS b
      ),
      '[]'::jsonb
    )
  )
FROM public.ig_triggers t
CROSS JOIN LATERAL jsonb_array_elements(t.dm_flow -> 'steps')
  WITH ORDINALITY AS s (step, ordinality)
WHERE t.dm_enabled
  AND t.dm_flow IS NOT NULL
  AND jsonb_typeof(t.dm_flow -> 'steps') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM public.ig_automation_steps x WHERE x.trigger_id = t.id
  );

-- Static single-message DMs → one text step.
INSERT INTO public.ig_automation_steps (account_id, trigger_id, position, step_type, config)
SELECT
  t.account_id,
  t.id,
  0,
  'text',
  jsonb_build_object('text', t.dm_template)
FROM public.ig_triggers t
WHERE t.dm_enabled
  AND t.dm_flow IS NULL
  AND t.dm_mode = 'static'
  AND NULLIF(btrim(t.dm_template), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.ig_automation_steps x WHERE x.trigger_id = t.id
  );
