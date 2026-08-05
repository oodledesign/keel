-- Ensure WIP FK attachments and interest matches stay within the same account.

CREATE OR REPLACE FUNCTION public.validate_wip_attachment_account_fks()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.pipeline_deal_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.pipeline_deals d
      WHERE d.id = NEW.pipeline_deal_id
        AND d.account_id = NEW.account_id
    ) THEN
      RAISE EXCEPTION 'pipeline_deal_id does not belong to this account';
    END IF;
  END IF;

  IF NEW.commercial_requirement_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.commercial_requirements r
      WHERE r.id = NEW.commercial_requirement_id
        AND r.account_id = NEW.account_id
    ) THEN
      RAISE EXCEPTION 'commercial_requirement_id does not belong to this account';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_validate_wip_attachment_fks ON public.tasks;
CREATE TRIGGER tasks_validate_wip_attachment_fks
  BEFORE INSERT OR UPDATE OF pipeline_deal_id, commercial_requirement_id, account_id
  ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_wip_attachment_account_fks();

DROP TRIGGER IF EXISTS notes_validate_wip_attachment_fks ON public.notes;
CREATE TRIGGER notes_validate_wip_attachment_fks
  BEFORE INSERT OR UPDATE OF pipeline_deal_id, commercial_requirement_id, account_id
  ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_wip_attachment_account_fks();

CREATE OR REPLACE FUNCTION public.validate_commercial_match_account_fks()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.commercial_listings l
    WHERE l.id = NEW.listing_id
      AND l.account_id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'listing_id does not belong to this account';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.commercial_requirements r
    WHERE r.id = NEW.requirement_id
      AND r.account_id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'requirement_id does not belong to this account';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commercial_matches_validate_account_fks
  ON public.commercial_matches;
CREATE TRIGGER commercial_matches_validate_account_fks
  BEFORE INSERT OR UPDATE OF listing_id, requirement_id, account_id
  ON public.commercial_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_commercial_match_account_fks();
