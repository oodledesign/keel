-- Soften default invoice email copy. Microsoft 365 often quarantines
-- "ready for your payment" subjects + PDF attachments as invoice fraud.

UPDATE public.content_templates
SET
  subject = 'Invoice {{invoice.number}} from {{account.name}}',
  body_text = $text$Hello {{contact.firstName}},

Invoice {{invoice.number}} from {{account.name}} is ready to view online. Please let me know if you have any questions.

Thanks for your business!$text$,
  updated_at = now()
WHERE kind = 'invoice_email'
  AND slug = 'default-invoice-email'
  AND subject IS NOT DISTINCT FROM $old$Here's the invoice, ready for your payment$old$;

UPDATE public.account_content_templates
SET
  subject = 'Invoice {{invoice.number}} from {{account.name}}',
  updated_at = now()
WHERE kind = 'invoice_email'
  AND subject IS NOT DISTINCT FROM $old$Here's the invoice, ready for your payment$old$;

UPDATE public.account_content_templates
SET
  body_text = $text$Hello {{contact.firstName}},

Invoice {{invoice.number}} from {{account.name}} is ready to view online. Please let me know if you have any questions.

Thanks for your business!$text$,
  updated_at = now()
WHERE kind = 'invoice_email'
  AND body_text IS NOT DISTINCT FROM $old$Hello {{contact.firstName}},

Here is the link to view and pay the invoice online. Please let me know if you have any questions.

Thanks for your business!$old$;

UPDATE public.invoices
SET
  email_subject = 'Invoice {{invoice.number}} from {{account.name}}',
  updated_at = now()
WHERE email_subject IS NOT DISTINCT FROM $old$Here's the invoice, ready for your payment$old$;

UPDATE public.invoices
SET
  email_body = $text$Hello {{contact.firstName}},

Invoice {{invoice.number}} from {{account.name}} is ready to view online. Please let me know if you have any questions.

Thanks for your business!$text$,
  updated_at = now()
WHERE email_body IS NOT DISTINCT FROM $old$Hello {{contact.firstName}},

Here is the link to view and pay the invoice online. Please let me know if you have any questions.

Thanks for your business!$old$;
