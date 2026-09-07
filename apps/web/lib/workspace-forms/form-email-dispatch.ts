import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getLogger } from '@kit/shared/logger';

import {
  wrapEmailHtmlWithBrand,
  type AccountBrandResolved,
} from '~/lib/brand/account-brand';
import { sendClientFacingEmail } from '~/lib/server/send-client-facing-email';

import {
  buildFormEmailVars,
  interpolateFormEmailText,
  matchFormEmailTemplate,
  type WorkspaceFormEmailSettings,
  type WorkspaceFormEmailTemplate,
} from './form-email';
import type { FormContactValues, WorkspaceFormField } from './form-fields';

type DispatchForm = {
  id: string;
  accountId: string;
  accountName: string;
  accountSlug: string | null;
  name: string;
  eventAddress: string | null;
  fields: WorkspaceFormField[];
  emailSettings: WorkspaceFormEmailSettings;
  brand: AccountBrandResolved;
};

function renderTemplate(
  template: WorkspaceFormEmailTemplate,
  vars: Record<string, string>,
  brand: AccountBrandResolved,
) {
  const subject = interpolateFormEmailText(template.subject, vars);
  const inner = interpolateFormEmailText(template.bodyHtml || '', vars);
  const html = wrapEmailHtmlWithBrand({
    brand,
    innerHtml: inner || '<p></p>',
  });
  return { subject, html };
}

async function resolveMemberEmails(
  admin: SupabaseClient,
  accountSlug: string | null,
  memberIds: string[],
): Promise<string[]> {
  if (!accountSlug || memberIds.length === 0) return [];

  const { data } = await admin.rpc('get_account_members', {
    account_slug: accountSlug,
  });

  const wanted = new Set(memberIds);
  return (
    (data as Array<{ user_id: string; email: string | null }> | null) ?? []
  )
    .filter((row) => wanted.has(row.user_id) && row.email?.trim())
    .map((row) => row.email!.trim().toLowerCase());
}

async function sendOne(input: {
  type: 'form_autoresponder' | 'form_notification';
  accountId: string;
  accountName: string;
  brand: AccountBrandResolved;
  to: string;
  subject: string;
  html: string;
  metadata: Record<string, unknown>;
}) {
  await sendClientFacingEmail({
    type: input.type,
    accountId: input.accountId,
    feature: 'other',
    accountName: input.accountName,
    brandContactEmail: input.brand.contact_email,
    mail: {
      to: input.to,
      subject: input.subject,
      html: input.html,
    },
    metadata: input.metadata,
  });
}

/**
 * Best-effort post-submit emails. Failures are logged and never roll back
 * the stored submission.
 */
export async function dispatchWorkspaceFormEmails(input: {
  admin: SupabaseClient;
  form: DispatchForm;
  contact: FormContactValues;
  values: Record<string, unknown>;
  submissionId: string;
}): Promise<void> {
  const settings = input.form.emailSettings;
  if (settings.templates.length === 0 || settings.rules.length === 0) {
    return;
  }

  const logger = await getLogger();
  const vars = buildFormEmailVars({
    formName: input.form.name,
    accountName: input.form.accountName,
    eventAddress: input.form.eventAddress,
    contactName: input.contact.contactName,
    contactEmail: input.contact.contactEmail,
    fields: input.form.fields,
    values: input.values,
  });

  const ctx = {
    name: 'workspace-form-email',
    formId: input.form.id,
    submissionId: input.submissionId,
  };

  const auto = matchFormEmailTemplate(settings, input.values, 'autoresponder');
  if (auto && input.contact.contactEmail) {
    try {
      const rendered = renderTemplate(auto, vars, input.form.brand);
      await sendOne({
        type: 'form_autoresponder',
        accountId: input.form.accountId,
        accountName: input.form.accountName,
        brand: input.form.brand,
        to: input.contact.contactEmail,
        ...rendered,
        metadata: {
          form_id: input.form.id,
          submission_id: input.submissionId,
          template_id: auto.id,
        },
      });
    } catch (error) {
      logger.error(
        { ...ctx, error },
        'Form autoresponder email failed',
      );
    }
  }

  const notify = matchFormEmailTemplate(settings, input.values, 'notification');
  if (!notify) return;

  const memberEmails = await resolveMemberEmails(
    input.admin,
    input.form.accountSlug,
    settings.notifyMemberIds,
  );
  const recipients = [
    ...new Set([...memberEmails, ...settings.notifyEmails]),
  ].filter((email) => email !== input.contact.contactEmail.toLowerCase());

  if (recipients.length === 0) return;

  const rendered = renderTemplate(notify, vars, input.form.brand);

  await Promise.all(
    recipients.map(async (to) => {
      try {
        await sendOne({
          type: 'form_notification',
          accountId: input.form.accountId,
          accountName: input.form.accountName,
          brand: input.form.brand,
          to,
          ...rendered,
          metadata: {
            form_id: input.form.id,
            submission_id: input.submissionId,
            template_id: notify.id,
          },
        });
      } catch (error) {
        logger.error(
          { ...ctx, to, error },
          'Form notification email failed',
        );
      }
    }),
  );
}
