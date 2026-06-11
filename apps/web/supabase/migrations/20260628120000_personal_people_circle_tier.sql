-- Circle of trust tiers for personal People contacts.

ALTER TABLE public.personal_people
  ADD COLUMN IF NOT EXISTS circle_tier text NOT NULL DEFAULT 'friends'
  CHECK (circle_tier IN ('core', 'close', 'friends', 'community'));

COMMENT ON COLUMN public.personal_people.circle_tier IS
  'Closeness tier: core (inner circle/family), close, friends, community (wider network).';

CREATE INDEX IF NOT EXISTS ix_personal_people_circle_tier
  ON public.personal_people(user_id, circle_tier);

NOTIFY pgrst, 'reload schema';
