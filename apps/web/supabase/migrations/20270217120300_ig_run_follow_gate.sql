-- Follow gate state per run (require_follow triggers).

ALTER TABLE public.ig_automation_runs
  ADD COLUMN IF NOT EXISTS follow_gate_passed boolean NOT NULL DEFAULT false;
