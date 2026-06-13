-- Second brain: pgvector chunks + chat threads/messages.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.brain_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  chunk_index integer NOT NULL DEFAULT 0,
  content_text text NOT NULL,
  embedding vector(1024),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  indexed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brain_chunks_source_type_check CHECK (
    source_type IN (
      'note',
      'doc',
      'job',
      'job_note',
      'phase',
      'transcript',
      'proposal',
      'task'
    )
  ),
  CONSTRAINT brain_chunks_source_chunk_key UNIQUE (source_id, chunk_index)
);

COMMENT ON TABLE public.brain_chunks IS
  'Embedded Markdown chunks for semantic search (Keel second brain).';

CREATE INDEX IF NOT EXISTS ix_brain_chunks_account_source
  ON public.brain_chunks (account_id, source_type, source_id);

CREATE INDEX IF NOT EXISTS brain_chunks_embedding_idx
  ON public.brain_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE TABLE IF NOT EXISTS public.brain_chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brain_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.brain_chat_threads (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  context_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brain_chat_messages_role_check CHECK (role IN ('user', 'assistant'))
);

CREATE INDEX IF NOT EXISTS ix_brain_chat_threads_account_user
  ON public.brain_chat_threads (account_id, user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS ix_brain_chat_messages_thread_id
  ON public.brain_chat_messages (thread_id, created_at);

DROP TRIGGER IF EXISTS brain_chat_threads_set_timestamps ON public.brain_chat_threads;
CREATE TRIGGER brain_chat_threads_set_timestamps
  BEFORE INSERT OR UPDATE ON public.brain_chat_threads
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.brain_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_chat_messages ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.brain_chunks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_chat_threads TO authenticated;
GRANT SELECT, INSERT ON public.brain_chat_messages TO authenticated;
GRANT ALL ON public.brain_chunks TO service_role;
GRANT ALL ON public.brain_chat_threads TO service_role;
GRANT ALL ON public.brain_chat_messages TO service_role;

DROP POLICY IF EXISTS brain_chunks_select ON public.brain_chunks;
CREATE POLICY brain_chunks_select ON public.brain_chunks
  FOR SELECT TO authenticated
  USING (public.has_role_on_account (account_id));

DROP POLICY IF EXISTS brain_chat_threads_select ON public.brain_chat_threads;
CREATE POLICY brain_chat_threads_select ON public.brain_chat_threads
  FOR SELECT TO authenticated
  USING (
    public.has_role_on_account (account_id)
    AND user_id = auth.uid ()
  );

DROP POLICY IF EXISTS brain_chat_threads_insert ON public.brain_chat_threads;
CREATE POLICY brain_chat_threads_insert ON public.brain_chat_threads
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_on_account (account_id)
    AND user_id = auth.uid ()
  );

DROP POLICY IF EXISTS brain_chat_threads_update ON public.brain_chat_threads;
CREATE POLICY brain_chat_threads_update ON public.brain_chat_threads
  FOR UPDATE TO authenticated
  USING (
    public.has_role_on_account (account_id)
    AND user_id = auth.uid ()
  )
  WITH CHECK (
    public.has_role_on_account (account_id)
    AND user_id = auth.uid ()
  );

DROP POLICY IF EXISTS brain_chat_threads_delete ON public.brain_chat_threads;
CREATE POLICY brain_chat_threads_delete ON public.brain_chat_threads
  FOR DELETE TO authenticated
  USING (
    public.has_role_on_account (account_id)
    AND user_id = auth.uid ()
  );

DROP POLICY IF EXISTS brain_chat_messages_select ON public.brain_chat_messages;
CREATE POLICY brain_chat_messages_select ON public.brain_chat_messages
  FOR SELECT TO authenticated
  USING (public.has_role_on_account (account_id));

DROP POLICY IF EXISTS brain_chat_messages_insert ON public.brain_chat_messages;
CREATE POLICY brain_chat_messages_insert ON public.brain_chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_account (account_id));

CREATE OR REPLACE FUNCTION public.match_brain_chunks(
  query_embedding vector(1024),
  match_account_id uuid,
  match_threshold float DEFAULT 0.4,
  match_count int DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  source_type text,
  source_id uuid,
  chunk_index int,
  content_text text,
  metadata jsonb,
  similarity float
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    bc.id,
    bc.source_type,
    bc.source_id,
    bc.chunk_index,
    bc.content_text,
    bc.metadata,
    1 - (bc.embedding <=> query_embedding) AS similarity
  FROM public.brain_chunks bc
  WHERE bc.account_id = match_account_id
    AND bc.embedding IS NOT NULL
    AND 1 - (bc.embedding <=> query_embedding) > match_threshold
  ORDER BY bc.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_brain_chunks(vector(1024), uuid, float, int)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
