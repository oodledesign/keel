-- Business onboarding Continue updates accounts_memberships.onboarding_completed
-- to true after create_team_account already inserted the owner row as complete.
-- kit.prevent_memberships_update previously raised unless an allowlisted column
-- actually changed, so that no-op (and timestamp-only) UPDATE failed with:
--   Only account_role, company_role, trade_role, onboarding_step,
--   onboarding_completed, and seat_kind can be updated
--
-- Keep identity / created_* immutable. Allow role, onboarding, seat_kind, and
-- the updated_at / updated_by columns set by the timestamp/user-tracking
-- triggers. Apply on production even if deploys do not auto-run SQL.

CREATE OR REPLACE FUNCTION kit.prevent_memberships_update()
RETURNS trigger
SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  IF new.user_id IS DISTINCT FROM old.user_id
     OR new.account_id IS DISTINCT FROM old.account_id
     OR new.created_at IS DISTINCT FROM old.created_at
     OR new.created_by IS DISTINCT FROM old.created_by THEN
    RAISE EXCEPTION
      'Only account_role, company_role, trade_role, onboarding_step, onboarding_completed, and seat_kind can be updated';
  END IF;

  RETURN new;
END;
$$;

COMMENT ON FUNCTION kit.prevent_memberships_update() IS
  'Blocks accounts_memberships identity/created_* changes. Allows role, onboarding, seat_kind, and no-op/timestamp updates.';
