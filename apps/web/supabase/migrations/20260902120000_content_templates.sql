-- Content templates: system defaults (super-admin), workspace customs, personal email reply presets.

CREATE TABLE IF NOT EXISTS public.content_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (
    kind IN (
      'proposal_html',
      'proposal_email',
      'contract_email',
      'email_reply'
    )
  ),
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  subject text,
  body_html text NOT NULL DEFAULT '',
  body_text text NOT NULL DEFAULT '',
  signature text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_templates_slug_kind_unique UNIQUE (kind, slug)
);

CREATE INDEX IF NOT EXISTS ix_content_templates_kind_active
  ON public.content_templates (kind, is_active, sort_order ASC);

COMMENT ON TABLE public.content_templates IS
  'Platform system content templates editable by super-admins.';

CREATE TABLE IF NOT EXISTS public.account_content_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (
    kind IN ('proposal_html', 'proposal_email', 'contract_email')
  ),
  name text NOT NULL,
  description text,
  subject text,
  body_html text NOT NULL DEFAULT '',
  body_text text NOT NULL DEFAULT '',
  signature text,
  is_default boolean NOT NULL DEFAULT false,
  source_system_template_id uuid REFERENCES public.content_templates (id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_account_content_templates_account_kind
  ON public.account_content_templates (account_id, kind, is_default DESC, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ux_account_content_templates_one_default
  ON public.account_content_templates (account_id, kind)
  WHERE is_default = true;

COMMENT ON TABLE public.account_content_templates IS
  'Workspace-owned proposal and send-email templates.';

CREATE TABLE IF NOT EXISTS public.user_content_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'email_reply'
    CHECK (kind = 'email_reply'),
  name text NOT NULL,
  body_text text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  source_system_template_id uuid REFERENCES public.content_templates (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_user_content_templates_user
  ON public.user_content_templates (user_id, kind, is_default DESC, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ux_user_content_templates_one_default
  ON public.user_content_templates (user_id, kind)
  WHERE is_default = true;

COMMENT ON TABLE public.user_content_templates IS
  'Personal Gmail reply presets.';

DROP TRIGGER IF EXISTS content_templates_set_timestamps ON public.content_templates;
CREATE TRIGGER content_templates_set_timestamps
  BEFORE UPDATE ON public.content_templates
  FOR EACH ROW
  EXECUTE PROCEDURE public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS account_content_templates_set_timestamps
  ON public.account_content_templates;
CREATE TRIGGER account_content_templates_set_timestamps
  BEFORE UPDATE ON public.account_content_templates
  FOR EACH ROW
  EXECUTE PROCEDURE public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS user_content_templates_set_timestamps
  ON public.user_content_templates;
CREATE TRIGGER user_content_templates_set_timestamps
  BEFORE UPDATE ON public.user_content_templates
  FOR EACH ROW
  EXECUTE PROCEDURE public.trigger_set_timestamps();

ALTER TABLE public.content_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_content_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_content_templates ENABLE ROW LEVEL SECURITY;

-- System templates: all authenticated can read (pickers); only super-admin mutates.
DROP POLICY IF EXISTS content_templates_select ON public.content_templates;
CREATE POLICY content_templates_select ON public.content_templates
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS content_templates_insert ON public.content_templates;
CREATE POLICY content_templates_insert ON public.content_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS content_templates_update ON public.content_templates;
CREATE POLICY content_templates_update ON public.content_templates
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS content_templates_delete ON public.content_templates;
CREATE POLICY content_templates_delete ON public.content_templates
  FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- Account templates: invoice permissions (same as proposals).
DROP POLICY IF EXISTS account_content_templates_select ON public.account_content_templates;
CREATE POLICY account_content_templates_select ON public.account_content_templates
  FOR SELECT TO authenticated
  USING (
    public.has_permission(
      auth.uid(),
      account_id,
      'invoices.view'::public.app_permissions
    )
    OR public.has_permission(
      auth.uid(),
      account_id,
      'invoices.edit'::public.app_permissions
    )
    OR public.has_role_on_account(account_id)
  );

DROP POLICY IF EXISTS account_content_templates_insert ON public.account_content_templates;
CREATE POLICY account_content_templates_insert ON public.account_content_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission(
      auth.uid(),
      account_id,
      'invoices.edit'::public.app_permissions
    )
  );

DROP POLICY IF EXISTS account_content_templates_update ON public.account_content_templates;
CREATE POLICY account_content_templates_update ON public.account_content_templates
  FOR UPDATE TO authenticated
  USING (
    public.has_permission(
      auth.uid(),
      account_id,
      'invoices.edit'::public.app_permissions
    )
  )
  WITH CHECK (
    public.has_permission(
      auth.uid(),
      account_id,
      'invoices.edit'::public.app_permissions
    )
  );

DROP POLICY IF EXISTS account_content_templates_delete ON public.account_content_templates;
CREATE POLICY account_content_templates_delete ON public.account_content_templates
  FOR DELETE TO authenticated
  USING (
    public.has_permission(
      auth.uid(),
      account_id,
      'invoices.edit'::public.app_permissions
    )
  );

-- Personal reply presets.
DROP POLICY IF EXISTS user_content_templates_select ON public.user_content_templates;
CREATE POLICY user_content_templates_select ON public.user_content_templates
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_content_templates_insert ON public.user_content_templates;
CREATE POLICY user_content_templates_insert ON public.user_content_templates
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_content_templates_update ON public.user_content_templates;
CREATE POLICY user_content_templates_update ON public.user_content_templates
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_content_templates_delete ON public.user_content_templates;
CREATE POLICY user_content_templates_delete ON public.user_content_templates
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON public.content_templates FROM authenticated, service_role;
REVOKE ALL ON public.account_content_templates FROM authenticated, service_role;
REVOKE ALL ON public.user_content_templates FROM authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_content_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_content_templates TO authenticated;
GRANT ALL ON public.content_templates TO service_role;
GRANT ALL ON public.account_content_templates TO service_role;
GRANT ALL ON public.user_content_templates TO service_role;

-- Seeds: proposal HTML starters
INSERT INTO public.content_templates (
  kind, name, slug, description, body_html, body_text, sort_order
)
VALUES
(
  'proposal_html',
  'Standard freelance proposal',
  'standard-freelance',
  'Default UK freelance proposal structure with goal, scope, packages, and payment plan.',
  $html$
<h2>The Goal</h2>
<p>Summarise what success looks like for {{client.fullName}} and {{client.company}}.</p>
<h2>About You</h2>
<p>Brief introduction to {{account.name}} and why you are a fit for this work.</p>
<h2>The Format</h2>
<p>Describe the engagement format (workshop, retainers, fixed project, etc.).</p>
<h2>What's Included</h2>
<ul>
  <li>Discovery and scoping</li>
  <li>Core deliverables</li>
  <li>Revisions and handoff</li>
</ul>
<h2>Add-ons</h2>
<ul>
  <li>Optional extras available on request</li>
</ul>
<h2>Payment Plan</h2>
<ul>
  <li>50% on signing</li>
  <li>50% on delivery</li>
</ul>
<h2>Next Steps</h2>
<p>Approve this proposal to confirm the engagement, or reply with questions.</p>
$html$,
  '',
  0
),
(
  'proposal_html',
  'Simple fixed-fee proposal',
  'simple-fixed-fee',
  'Shorter proposal for a single fixed-fee engagement.',
  $html$
<h2>The Goal</h2>
<p>Outline the outcome for {{client.firstName}}.</p>
<h2>What's Included</h2>
<ul>
  <li>Scope item one</li>
  <li>Scope item two</li>
  <li>Delivery and handover</li>
</ul>
<h2>Investment</h2>
<p>Total: {{proposal.total}}</p>
<h2>Payment Plan</h2>
<ul>
  <li>100% on signing</li>
</ul>
<h2>Next Steps</h2>
<p>Approve when you are ready to proceed.</p>
$html$,
  '',
  1
),
(
  'proposal_html',
  'Retainer proposal',
  'retainer',
  'Monthly retainer structure with cadence and inclusions.',
  $html$
<h2>The Goal</h2>
<p>Ongoing support for {{client.company}} via a monthly retainer with {{account.name}}.</p>
<h2>The Format</h2>
<p>Monthly retainer with agreed hours/deliverables and a clear communication cadence.</p>
<h2>What's Included</h2>
<ul>
  <li>Priority availability</li>
  <li>Agreed monthly deliverables</li>
  <li>Progress check-ins</li>
</ul>
<h2>Payment Plan</h2>
<ul>
  <li>Monthly in advance</li>
</ul>
<h2>Next Steps</h2>
<p>Approve to start the retainer, or suggest amendments.</p>
$html$,
  '',
  2
)
ON CONFLICT (kind, slug) DO NOTHING;

-- Seeds: proposal / contract send emails
INSERT INTO public.content_templates (
  kind, name, slug, description, subject, body_text, signature, sort_order
)
VALUES
(
  'proposal_email',
  'Default proposal email',
  'default-proposal-email',
  'Standard email when sending a proposal for review.',
  'Your proposal from {{account.name}}',
  $text$Hello {{client.firstName}},

Please review the proposal below. You can approve, decline, or leave a comment directly from the link.

Let me know if you have any questions.$text$,
  $sig$Best regards,
{{your.firstName}} {{your.lastName}}
{{account.name}}$sig$,
  0
),
(
  'contract_email',
  'Default contract email',
  'default-contract-email',
  'Standard email when sending an agreement to sign.',
  'Your agreement from {{account.name}}',
  $text$Hello {{client.firstName}},

Your agreement is ready to review and sign. Please open the link below when you are ready.

Thank you.$text$,
  $sig$Best regards,
{{your.firstName}} {{your.lastName}}
{{account.name}}$sig$,
  0
)
ON CONFLICT (kind, slug) DO NOTHING;

-- Seeds: Gmail reply presets
INSERT INTO public.content_templates (
  kind, name, slug, description, body_text, sort_order
)
VALUES
(
  'email_reply',
  'Thanks — will review',
  'thanks-will-review',
  'Acknowledge receipt and promise a follow-up.',
  $text$Thanks for this — I've got it and will review shortly.

I'll come back to you once I've had a proper look.$text$,
  0
),
(
  'email_reply',
  'Quick confirm',
  'quick-confirm',
  'Short confirmation.',
  $text$Thanks — confirmed on my side.

Happy to proceed as discussed.$text$,
  1
),
(
  'email_reply',
  'Need more info',
  'need-more-info',
  'Ask for clarifying details.',
  $text$Thanks for sending this over.

Could you share a bit more detail so I can respond properly? In particular I'm keen to understand timelines and any constraints on your side.$text$,
  2
)
ON CONFLICT (kind, slug) DO NOTHING;

NOTIFY pgrst, 'reload schema';
