-- Platform seats: Ozer super-admins embedded in customer workspaces without billing impact.

ALTER TABLE public.accounts_memberships
  DROP CONSTRAINT IF EXISTS accounts_memberships_seat_kind_check;

ALTER TABLE public.accounts_memberships
  ADD CONSTRAINT accounts_memberships_seat_kind_check
  CHECK (seat_kind IN ('billable', 'support', 'platform'));

COMMENT ON COLUMN public.accounts_memberships.seat_kind IS
  'Commercial Property: billable seats count toward Stripe; support uses free allowance; platform (Ozer super-admins) uses neither.';

ALTER TABLE public.invitations
  DROP CONSTRAINT IF EXISTS invitations_seat_kind_check;

ALTER TABLE public.invitations
  ADD CONSTRAINT invitations_seat_kind_check
  CHECK (seat_kind IN ('billable', 'support', 'platform'));

COMMENT ON COLUMN public.invitations.seat_kind IS
  'Copied onto accounts_memberships.seat_kind when accepted. Platform invites are admin-only.';
