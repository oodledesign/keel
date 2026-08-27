-- Renumber onboarding_step after removing the Trade Role step from staff/contractor flow.
-- Old: 1 contexts, 2 trade, 3 personal, 4 accessibility
-- New: 1 contexts, 2 personal, 3 accessibility

UPDATE public.accounts_memberships
SET onboarding_step = onboarding_step - 1
WHERE company_role IN ('staff_member', 'contractor')
  AND onboarding_completed = false
  AND onboarding_step > 2;
