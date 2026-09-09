import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getLogger } from '@kit/shared/logger';

import pathsConfig from '~/config/paths.config';
import {
  type AccountBrandResolved,
  wrapEmailHtmlWithBrand,
} from '~/lib/brand/account-brand';
import { sendClientFacingEmail } from '~/lib/server/send-client-facing-email';
import { formEditorTabHref } from '~/lib/workspace-forms/form-editor-tab';

import {
  type WorkspaceFormEmailSettings,
  type WorkspaceFormEmailTemplate,
  buildFormEmailVars,
  composeFormNotificationBody,
  interpolateFormEmailHtml,
  interpolateFormEmailText,
  listFormSubmittedAnswers,
  matchFormEmailTemplate,
  renderFormAnswersHtml,
  renderFormAnswersText,
  withFormEmailHtmlVars,
} from './form-email';
import type { FormContactValues, WorkspaceFormField } from './form-fields';

type DispatchForm = {
  id: string;
  accountId: string;
  accountName: string;
  accountSlug: string | null;
  name: string;
  eventAddress: string | null;
  eventDate?: string | null;
  eventTime?: string | null;
  fields: WorkspaceFormField[];
  emailSettings: WorkspaceFormEmailSettings;
  brand: AccountBrandResolved;
};

function formSubmissionsUrl(
  accountSlug: string | null,
  formId: string,
): string {
  if (!accountSlug || !formId) return '';
  const base = (
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://ozer.so'
  ).replace(/\/$/, '');
  const path = formEditorTabHref(
    pathsConfig.app.accountFormDetail
      .replace('[account]', accountSlug)
      .replace('[formId]', formId),
    'submissions',
  );
  return `${base}${path}`;
}

function wrapRendered(
  subject: string,
  inner: string,
  brand: AccountBrandResolved,
) {
  return {
    subject,
    html: wrapEmailHtmlWithBrand({
      brand,
      innerHtml: inner || '<p></p>',
    }),
  };
}

function renderAutoresponder(
  template: WorkspaceFormEmailTemplate,
  vars: Record<string, string>,
  brand: AccountBrandResolved,
  answersHtml: string,
) {
  return wrapRendered(
    interpolateFormEmailText(template.subject, vars),
    interpolateFormEmailHtml(
      template.bodyHtml || '',
      withFormEmailHtmlVars(vars, answersHtml),
    ),
    brand,
  );
}

function renderNotification(
  template: WorkspaceFormEmailTemplate,
  vars: Record<string, string>,
  brand: AccountBrandResolved,
  includeSubmittedAnswers: boolean,
  answersHtml: string,
  answersText: string,
) {
  const subjectVars = {
    ...vars,
    answers: answersText,
    submitted_answers: answersText,
  };
  return wrapRendered(
    interpolateFormEmailText(template.subject, subjectVars),
    composeFormNotificationBody({
      bodyHtml: template.bodyHtml || '',
      vars,
      includeSubmittedAnswers,
      answersHtml,
    }),
    brand,
  );
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
  displayName?: string;
  platformDisplayName?: string;
  forcePlatformFrom?: boolean;
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
    displayName: input.displayName,
    platformDisplayName: input.platformDisplayName,
    forcePlatformFrom: input.forcePlatformFrom,
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
  const submissionUrl = formSubmissionsUrl(
    input.form.accountSlug,
    input.form.id,
  );
  const vars = buildFormEmailVars({
    formName: input.form.name,
    accountName: input.form.accountName,
    eventAddress: input.form.eventAddress,
    eventDate: input.form.eventDate,
    eventTime: input.form.eventTime,
    contactName: input.contact.contactName,
    contactEmail: input.contact.contactEmail,
    fields: input.form.fields,
    values: input.values,
    submissionUrl,
  });
  const answers = listFormSubmittedAnswers({
    fields: input.form.fields,
    values: input.values,
  });
  const answersHtml = renderFormAnswersHtml(answers, submissionUrl);
  const answersText = renderFormAnswersText(answers);

  const ctx = {
    name: 'workspace-form-email',
    formId: input.form.id,
    submissionId: input.submissionId,
  };

  const auto = matchFormEmailTemplate(settings, input.values, 'autoresponder');
  if (auto && input.contact.contactEmail) {
    try {
      const rendered = renderAutoresponder(
        auto,
        vars,
        input.form.brand,
        answersHtml,
      );
      await sendOne({
        type: 'form_autoresponder',
        accountId: input.form.accountId,
        accountName: input.form.accountName,
        brand: input.form.brand,
        displayName: input.form.accountName,
        platformDisplayName: `${input.form.accountName} via Ozer`,
        to: input.contact.contactEmail,
        ...rendered,
        metadata: {
          form_id: input.form.id,
          submission_id: input.submissionId,
          template_id: auto.id,
        },
      });
    } catch (error) {
      logger.error({ ...ctx, error }, 'Form autoresponder email failed');
    }
  }

  const notify = matchFormEmailTemplate(settings, input.values, 'notification');
  if (!notify) return;

  const memberEmails = await resolveMemberEmails(
    input.admin,
    input.form.accountSlug,
    settings.notifyMemberIds,
  );
  const submitterEmail = input.contact.contactEmail.trim().toLowerCase();
  const candidates = [...new Set([...memberEmails, ...settings.notifyEmails])];
  const recipients = candidates.filter((email) => email !== submitterEmail);

  if (recipients.length === 0) {
    logger.warn(
      {
        ...ctx,
        notifyMemberIds: settings.notifyMemberIds,
        notifyEmails: settings.notifyEmails,
        candidateCount: candidates.length,
        submitterEmail: submitterEmail || null,
      },
      candidates.length > 0
        ? 'Form team notification skipped: every recipient matched the submitter email'
        : 'Form team notification skipped: no notify members or emails configured',
    );
    return;
  }

  const rendered = renderNotification(
    notify,
    vars,
    input.form.brand,
    settings.includeSubmittedAnswers,
    answersHtml,
    answersText,
  );

  await Promise.all(
    recipients.map(async (to) => {
      try {
        await sendOne({
          type: 'form_notification',
          accountId: input.form.accountId,
          accountName: input.form.accountName,
          brand: input.form.brand,
          forcePlatformFrom: true,
          platformDisplayName: 'Ozer',
          to,
          ...rendered,
          metadata: {
            form_id: input.form.id,
            submission_id: input.submissionId,
            template_id: notify.id,
          },
        });
      } catch (error) {
        logger.error({ ...ctx, to, error }, 'Form notification email failed');
      }
    }),
  );
}
