-- Allow email threads in second brain index (linked / needs-reply only at app layer).

ALTER TABLE public.brain_chunks
  DROP CONSTRAINT IF EXISTS brain_chunks_source_type_check;

ALTER TABLE public.brain_chunks
  ADD CONSTRAINT brain_chunks_source_type_check CHECK (
    source_type IN (
      'note',
      'doc',
      'job',
      'job_note',
      'phase',
      'transcript',
      'proposal',
      'task',
      'email_thread'
    )
  );

NOTIFY pgrst, 'reload schema';
