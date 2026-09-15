-- Path A: a surveyor can open a survey from an address before a client
-- is attached, and site sessions can hang off that survey via proposal_id.
-- survey_type / proposal_id / survey_observations already exist (Phase 1).

ALTER TABLE public.proposals DROP CONSTRAINT IF EXISTS proposals_client_or_deal;
ALTER TABLE public.proposals ADD CONSTRAINT proposals_client_or_deal CHECK (
  kind = 'survey_report'
  OR client_id IS NOT NULL
  OR deal_id IS NOT NULL
);

ALTER TABLE public.meeting_transcripts
  DROP CONSTRAINT IF EXISTS meeting_transcripts_client_or_deal;
ALTER TABLE public.meeting_transcripts
  ADD CONSTRAINT meeting_transcripts_client_or_deal CHECK (
    client_id IS NOT NULL
    OR deal_id IS NOT NULL
    OR proposal_id IS NOT NULL
  );

COMMENT ON CONSTRAINT proposals_client_or_deal ON public.proposals IS
  'Ordinary proposals still need a client or deal. Survey reports may be created on site with only an address.';

COMMENT ON CONSTRAINT meeting_transcripts_client_or_deal ON public.meeting_transcripts IS
  'In-room meetings need a client or deal. Site sessions may link through proposal_id only.';

NOTIFY pgrst, 'reload schema';
