-- Prompt E2: site-level llms.txt draft (edit-before-export on Search tab).

ALTER TABLE public.website_briefs
  ADD COLUMN IF NOT EXISTS llms_txt text;

COMMENT ON COLUMN public.website_briefs.llms_txt IS
  'Optional edit-before-export llms.txt Markdown override (Prompt E2). Null → generate from contract.';
