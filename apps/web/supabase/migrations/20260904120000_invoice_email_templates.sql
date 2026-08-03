-- Add invoice_email content template kind (system + workspace customs).

ALTER TABLE public.content_templates
  DROP CONSTRAINT IF EXISTS content_templates_kind_check;

ALTER TABLE public.content_templates
  ADD CONSTRAINT content_templates_kind_check CHECK (
    kind IN (
      'proposal_html',
      'proposal_email',
      'contract_email',
      'invoice_email',
      'email_reply'
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
      'invoice_email'
    )
  );

INSERT INTO public.content_templates (
  kind, name, slug, description, subject, body_text, signature, sort_order
)
VALUES
(
  'invoice_email',
  'Default invoice email',
  'default-invoice-email',
  'Standard email when sending an invoice for payment.',
  $subj$Here's the invoice, ready for your payment$subj$,
  $text$Hello {{contact.firstName}},

Here is the link to view and pay the invoice online. Please let me know if you have any questions.

Thanks for your business!$text$,
  $sig$Sincerely,
{{your.firstName}} {{your.lastName}}$sig$,
  0
)
ON CONFLICT (kind, slug) DO NOTHING;
