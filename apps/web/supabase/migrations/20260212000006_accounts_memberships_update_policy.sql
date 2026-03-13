-- Allow users to update their own membership row (for onboarding: trade_role, onboarding_step, onboarding_completed, etc.)
-- Without this policy, RLS blocks all UPDATEs on accounts_memberships; the trigger already restricts which columns can change.

CREATE POLICY accounts_memberships_update_own
  ON public.accounts_memberships
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
