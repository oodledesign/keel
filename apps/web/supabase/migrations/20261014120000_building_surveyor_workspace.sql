-- Building Surveyor workspace: first-class space_type.
-- Reuses pipeline_deals, proposals (kind=survey_report), docs, and meeting_transcripts.

-- ---------------------------------------------------------------------------
-- 1. Allow space_type = building-surveyor (stored as-is, not remapped)
-- ---------------------------------------------------------------------------
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_space_type_valid;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_space_type_valid CHECK (
  is_personal_account = true
  OR space_type IN (
    'work',
    'family',
    'community',
    'property',
    'commercial-property',
    'building-surveyor'
  )
);

COMMENT ON COLUMN public.accounts.space_type IS
  'For non-personal accounts: work, family, community, property (legacy), commercial-property, or building-surveyor. NULL when is_personal_account.';

-- ---------------------------------------------------------------------------
-- 2. Survey reports are proposals with a document kind
-- ---------------------------------------------------------------------------
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'proposal';

ALTER TABLE public.proposals DROP CONSTRAINT IF EXISTS proposals_kind_check;
ALTER TABLE public.proposals ADD CONSTRAINT proposals_kind_check
  CHECK (kind IN ('proposal', 'survey_report'));

CREATE INDEX IF NOT EXISTS ix_proposals_account_id_kind
  ON public.proposals (account_id, kind, created_at DESC);

COMMENT ON COLUMN public.proposals.kind IS
  'proposal = freelance/agency proposal; survey_report = building survey report (same writer).';

-- ---------------------------------------------------------------------------
-- 3. Pin existing docs/files onto a survey report section
-- ---------------------------------------------------------------------------
ALTER TABLE public.docs
  ADD COLUMN IF NOT EXISTS proposal_id uuid REFERENCES public.proposals (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pinned_section_key text;

CREATE INDEX IF NOT EXISTS ix_docs_proposal_id
  ON public.docs (proposal_id)
  WHERE proposal_id IS NOT NULL;

COMMENT ON COLUMN public.docs.proposal_id IS
  'Optional link to a proposal / survey report. Survey photos reuse the docs file model.';
COMMENT ON COLUMN public.docs.pinned_section_key IS
  'When set, this file is pinned onto the matching building-survey section heading.';

-- ---------------------------------------------------------------------------
-- 4. Pipeline stages for enquiry → quote → booking
-- ---------------------------------------------------------------------------
ALTER TABLE public.pipeline_deals
  DROP CONSTRAINT IF EXISTS pipeline_deals_stage_check;

ALTER TABLE public.pipeline_deals
  ADD CONSTRAINT pipeline_deals_stage_check
  CHECK (
    stage = ANY (
      ARRAY[
        -- Work CRM
        'lead',
        'qualified',
        'call_booked',
        'proposal_sent',
        'negotiation',
        'won',
        'lost',
        -- Commercial WIP Instructions
        'potential',
        'current',
        'under_offer_negotiating',
        'completed_exchanged',
        'fallen_through',
        -- Building Surveyor
        'quoted',
        'accepted',
        'booked',
        'surveyed',
        'reported',
        -- Legacy Kato / pre-WIP
        'shortlisted',
        'enquiry',
        'viewing',
        'negotiating',
        'under_offer',
        'signed',
        'idle',
        'discounted',
        'offer',
        'hots',
        'solicitors',
        'completed',
        'fell_through'
      ]
    )
  );

COMMENT ON CONSTRAINT pipeline_deals_stage_check ON public.pipeline_deals IS
  'Work CRM + commercial WIP + building-surveyor enquiry stages (legacy keys kept).';

-- ---------------------------------------------------------------------------
-- 5. Content template kind for the RICS-style survey report
-- ---------------------------------------------------------------------------
ALTER TABLE public.content_templates
  DROP CONSTRAINT IF EXISTS content_templates_kind_check;

ALTER TABLE public.content_templates
  ADD CONSTRAINT content_templates_kind_check CHECK (
    kind IN (
      'proposal_html',
      'proposal_email',
      'contract_email',
      'invoice_email',
      'email_reply',
      'survey_report_html'
    )
  );

ALTER TABLE public.account_content_templates
  DROP CONSTRAINT IF EXISTS account_content_templates_kind_check;

ALTER TABLE public.account_content_templates
  ADD CONSTRAINT account_content_templates_kind_check CHECK (
    kind IN (
      'proposal_html',
      'proposal_email',
      'contract_email',
      'invoice_email',
      'survey_report_html'
    )
  );

INSERT INTO public.content_templates (
  kind, name, slug, description, subject, body_html, body_text, sort_order
)
VALUES (
  'survey_report_html',
  'RICS Home Survey headings',
  'rics-home-survey',
  'Standard UK building / RICS Home Survey section headings. Not a branded GoReport format.',
  NULL,
  $html$<h2 data-section="about_inspection">About this inspection</h2>
<p></p>
<h2 data-section="overall_opinion">Overall opinion</h2>
<p></p>
<h2 data-section="about_property">About the property</h2>
<p></p>
<h2 data-section="chimney_stacks">Chimney stacks</h2>
<p></p>
<h2 data-section="roof_coverings">Roof coverings</h2>
<p></p>
<h2 data-section="rainwater">Rainwater pipes and gutters</h2>
<p></p>
<h2 data-section="main_walls">Main walls</h2>
<p></p>
<h2 data-section="windows">Windows</h2>
<p></p>
<h2 data-section="outside_doors">Outside doors</h2>
<p></p>
<h2 data-section="conservatory_porches">Conservatory and porches</h2>
<p></p>
<h2 data-section="other_joinery">Other joinery and finishes</h2>
<p></p>
<h2 data-section="roof_structure">Roof structure</h2>
<p></p>
<h2 data-section="ceilings">Ceilings</h2>
<p></p>
<h2 data-section="walls_partitions">Walls and partitions</h2>
<p></p>
<h2 data-section="floors">Floors</h2>
<p></p>
<h2 data-section="fireplaces">Fireplaces, chimney breasts and flues</h2>
<p></p>
<h2 data-section="built_in_fittings">Built-in fittings</h2>
<p></p>
<h2 data-section="woodwork">Woodwork</h2>
<p></p>
<h2 data-section="bathroom_fittings">Bathroom fittings</h2>
<p></p>
<h2 data-section="electricity">Electricity</h2>
<p></p>
<h2 data-section="gas_oil">Gas / oil</h2>
<p></p>
<h2 data-section="water">Water</h2>
<p></p>
<h2 data-section="heating">Heating</h2>
<p></p>
<h2 data-section="water_heating">Water heating</h2>
<p></p>
<h2 data-section="drainage">Drainage</h2>
<p></p>
<h2 data-section="grounds">Grounds</h2>
<p></p>
<h2 data-section="garage_outbuildings">Garage and outbuildings</h2>
<p></p>
<h2 data-section="legal_advisers">Issues for your legal advisers</h2>
<p></p>
<h2 data-section="risks">Risks</h2>
<p></p>
<h2 data-section="energy">Energy efficiency</h2>
<p></p>
<h2 data-section="declaration">Surveyor's declaration</h2>
<p></p>
<h2 data-section="what_to_do_now">What to do now</h2>
<p></p>
<h2 data-section="rics_description">Description of the RICS Home Survey</h2>
<p>This report follows the standard RICS Home Survey / building survey headings. It is not a Go Report or RICS Pro Forms branded document. Condition ratings and recommendations should be confirmed by the inspecting surveyor.</p>$html$,
  '',
  0
)
ON CONFLICT (kind, slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. create_team_account — accept building-surveyor, store as-is
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_team_account(
  account_name text,
  user_id uuid,
  account_slug text DEFAULT NULL,
  account_space_type text DEFAULT 'work',
  account_business_type text DEFAULT 'other',
  account_complete_onboarding boolean DEFAULT false
)
RETURNS public.accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_account public.accounts;
  owner_role varchar(50);
  normalized_space_type text;
  normalized_business_type text;
  store_space_type text;
  business_slug text;
  has_business_slug boolean;
  membership_onboarding_completed boolean;
  seed_business_type text;
BEGIN
  IF NOT public.is_set('enable_team_accounts') THEN
    RAISE EXCEPTION 'Team accounts are not enabled';
  END IF;

  membership_onboarding_completed := COALESCE(account_complete_onboarding, false);

  normalized_space_type := lower(coalesce(account_space_type, 'work'));
  normalized_business_type := lower(coalesce(account_business_type, 'other'));

  IF normalized_space_type NOT IN (
    'work', 'family', 'community', 'property', 'commercial-property', 'building-surveyor'
  ) THEN
    RAISE EXCEPTION
      'Invalid account_space_type. Expected work, family, community, property, commercial-property, or building-surveyor.';
  END IF;

  IF normalized_business_type NOT IN ('design', 'property', 'other', 'lite') THEN
    RAISE EXCEPTION 'Invalid account_business_type. Expected design, property, other, or lite.';
  END IF;

  -- Landlord property remaps to work; commercial-property and building-surveyor are first-class
  IF normalized_space_type IN ('work', 'property') THEN
    store_space_type := 'work';
  ELSE
    store_space_type := normalized_space_type;
  END IF;

  seed_business_type := CASE
    WHEN normalized_business_type = 'lite' THEN 'lite'
    WHEN normalized_space_type = 'property' OR normalized_business_type = 'property' THEN 'property'
    WHEN normalized_business_type = 'design' THEN 'design'
    ELSE 'other'
  END;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'businesses'
      AND column_name = 'slug'
  ) INTO has_business_slug;

  SELECT public.get_upper_system_role() INTO owner_role;

  INSERT INTO public.accounts (
    name,
    slug,
    is_personal_account,
    primary_owner_user_id,
    space_type
  )
  VALUES (
    account_name,
    account_slug,
    false,
    user_id,
    store_space_type
  )
  RETURNING * INTO new_account;

  INSERT INTO public.accounts_memberships (
    account_id,
    user_id,
    account_role,
    company_role,
    onboarding_step,
    onboarding_completed
  )
  VALUES (
    new_account.id,
    user_id,
    COALESCE(owner_role, 'owner'),
    'admin',
    1,
    membership_onboarding_completed
  );

  PERFORM public.seed_account_module_settings(
    new_account.id,
    store_space_type,
    seed_business_type
  );

  IF store_space_type = 'work' AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'businesses'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.businesses b WHERE b.account_id = new_account.id
    ) THEN
      business_slug := COALESCE(
        nullif(trim(account_slug), ''),
        lower(regexp_replace(account_name, '[^a-zA-Z0-9]+', '-', 'g'))
      );

      IF has_business_slug THEN
        INSERT INTO public.businesses (account_id, name, type, slug, owner_id)
        VALUES (
          new_account.id,
          account_name,
          seed_business_type,
          business_slug,
          user_id
        );
      ELSE
        INSERT INTO public.businesses (account_id, name, type, owner_id)
        VALUES (
          new_account.id,
          account_name,
          seed_business_type,
          user_id
        );
      END IF;
    END IF;
  END IF;

  IF store_space_type IN ('family', 'community') THEN
    INSERT INTO public.groups (account_id, name, kind)
    SELECT new_account.id, account_name,
      CASE WHEN store_space_type = 'family' THEN 'family' ELSE 'community' END
    WHERE EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'groups'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.groups g WHERE g.account_id = new_account.id
    );
  END IF;

  RETURN new_account;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. seed_account_module_settings — building-surveyor branch
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_account_module_settings(
  p_account_id uuid,
  p_space_type text DEFAULT 'work',
  p_business_type text DEFAULT 'other'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_space text;
  normalized_biz text;
  keys text[];
  k text;
BEGIN
  normalized_space := lower(coalesce(p_space_type, 'work'));
  normalized_biz := lower(coalesce(p_business_type, 'other'));

  IF normalized_space = 'family' THEN
    keys := ARRAY[
      'dashboard', 'tasks', 'jobs', 'calendar', 'meal_plan', 'shopping',
      'notes', 'members', 'settings'
    ];
  ELSIF normalized_space = 'community' THEN
    keys := ARRAY[
      'dashboard', 'schedule', 'tasks', 'notes', 'members', 'settings'
    ];
  ELSIF normalized_space = 'commercial-property' THEN
    keys := ARRAY[
      'dashboard', 'listings', 'pipeline', 'clients', 'properties',
      'requirements', 'viewings', 'proposals', 'leases', 'reports', 'docs',
      'tasks', 'notes', 'sops', 'team', 'settings'
    ];
  ELSIF normalized_space = 'building-surveyor' THEN
    keys := ARRAY[
      'dashboard', 'pipeline', 'clients', 'proposals', 'notes', 'docs',
      'tasks', 'team', 'settings'
    ];
  ELSIF normalized_space = 'property' OR normalized_biz = 'property' THEN
    keys := ARRAY[
      'dashboard', 'properties', 'clients', 'jobs', 'finances',
      'docs', 'tasks', 'notes', 'team', 'settings'
    ];
  ELSIF normalized_biz = 'lite' THEN
    keys := ARRAY['dashboard', 'apps', 'settings', 'team'];
  ELSE
    keys := ARRAY[
      'dashboard', 'jobs', 'tasks', 'schedule', 'pipeline', 'clients',
      'websites', 'support_tickets', 'client_portal', 'invoices', 'team',
      'notes', 'docs', 'sops', 'messages', 'finances', 'settings'
    ];
  END IF;

  FOREACH k IN ARRAY keys
  LOOP
    INSERT INTO public.account_module_settings (account_id, module_key, enabled)
    VALUES (p_account_id, k, true)
    ON CONFLICT (account_id, module_key) DO NOTHING;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
