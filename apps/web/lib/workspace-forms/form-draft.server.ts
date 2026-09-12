import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { randomBytes } from 'crypto';

import { getLogger } from '@kit/shared/logger';

import {
  type AccountBrandResolved,
  wrapEmailHtmlWithBrand,
} from '~/lib/brand/account-brand';
import { escapeEmailHtml } from '~/lib/email/ozer-transactional-shell';
import { sendClientFacingEmail } from '~/lib/server/send-client-facing-email';

import {
  buildFormResumeUrl,
  clampFormStepIndex,
  formDraftExpiresAt,
  isFormDraftExpired,
  isLikelyResumeToken,
  resumeEmailFromValues,
  sanitizeFormDraftValues,
} from './form-draft';
import type { WorkspaceFormField } from './form-fields';
import { buildPublicFormSteps } from './form-steps';
import type { PublicWorkspaceForm } from './public-form';

/** Tables not yet in generated Database types. */
function fromTable(client: SupabaseClient, table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from(table);
}

function generateResumeToken() {
  return randomBytes(24).toString('hex');
}

type DraftRow = {
  id: string;
  form_id: string;
  resume_token: string;
  payload: unknown;
  step_index: number;
  contact_email: string | null;
  expires_at: string;
};

export type PublicFormDraft = {
  resumeToken: string;
  values: Record<string, string | boolean>;
  stepIndex: number;
  contactEmail: string | null;
};

function mapDraft(
  row: DraftRow,
  fields: WorkspaceFormField[],
  stepCount: number,
): PublicFormDraft | null {
  if (isFormDraftExpired(row.expires_at)) return null;
  const raw =
    row.payload &&
    typeof row.payload === 'object' &&
    !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : {};
  return {
    resumeToken: row.resume_token,
    values: sanitizeFormDraftValues(fields, raw),
    stepIndex: clampFormStepIndex(row.step_index, stepCount),
    contactEmail: row.contact_email,
  };
}

export function publicFormStepCount(
  form: Pick<PublicWorkspaceForm, 'fields' | 'theme'>,
  options: { includeWelcome: boolean },
): number {
  if (form.theme.presentation !== 'steps') return 1;
  return Math.max(
    buildPublicFormSteps({
      fields: form.fields,
      includeWelcome: options.includeWelcome,
    }).length,
    1,
  );
}

export async function loadPublicFormDraft(
  admin: SupabaseClient,
  input: {
    formId: string;
    resumeToken: string | null | undefined;
    fields: WorkspaceFormField[];
    stepCount: number;
  },
): Promise<PublicFormDraft | null> {
  if (!isLikelyResumeToken(input.resumeToken)) return null;

  const { data, error } = await fromTable(admin, 'workspace_form_drafts')
    .select(
      'id, form_id, resume_token, payload, step_index, contact_email, expires_at',
    )
    .eq('resume_token', input.resumeToken)
    .eq('form_id', input.formId)
    .maybeSingle();

  if (error || !data) return null;
  return mapDraft(data as DraftRow, input.fields, input.stepCount);
}

export async function savePublicFormDraft(
  admin: SupabaseClient,
  input: {
    form: PublicWorkspaceForm;
    values: Record<string, unknown>;
    stepIndex: number;
    resumeToken?: string | null;
    includeWelcome: boolean;
    siteUrl?: string | null;
    embed?: boolean;
    listingId?: string | null;
    propertyId?: string | null;
  },
): Promise<{
  draft: PublicFormDraft;
  resumeUrl: string;
  emailed: boolean;
  email: string | null;
}> {
  const values = sanitizeFormDraftValues(input.form.fields, input.values);
  const stepCount = publicFormStepCount(input.form, {
    includeWelcome: input.includeWelcome,
  });
  const stepIndex = clampFormStepIndex(input.stepIndex, stepCount);
  const contactEmail = resumeEmailFromValues(input.form.fields, values);
  const expiresAt = formDraftExpiresAt().toISOString();

  let resumeToken = isLikelyResumeToken(input.resumeToken)
    ? input.resumeToken!.trim()
    : generateResumeToken();
  let createdNew = true;
  let previousEmail: string | null = null;

  if (isLikelyResumeToken(input.resumeToken)) {
    const { data: existing, error: existingError } = await fromTable(
      admin,
      'workspace_form_drafts',
    )
      .select('id, contact_email, expires_at')
      .eq('resume_token', resumeToken)
      .eq('form_id', input.form.id)
      .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message ?? 'Could not load draft');
    }

    const existingRow = existing as {
      id: string;
      contact_email: string | null;
      expires_at: string;
    } | null;

    if (existingRow && !isFormDraftExpired(existingRow.expires_at)) {
      createdNew = false;
      previousEmail = existingRow.contact_email;
      const { error: updateError } = await fromTable(
        admin,
        'workspace_form_drafts',
      )
        .update({
          payload: values,
          step_index: stepIndex,
          contact_email: contactEmail,
          expires_at: expiresAt,
        })
        .eq('id', existingRow.id);

      if (updateError) {
        throw new Error(updateError.message ?? 'Could not update draft');
      }
    } else {
      if (existingRow) {
        await fromTable(admin, 'workspace_form_drafts')
          .delete()
          .eq('id', existingRow.id);
      }
      resumeToken = generateResumeToken();
    }
  }

  if (createdNew) {
    const { error: insertError } = await fromTable(
      admin,
      'workspace_form_drafts',
    ).insert({
      account_id: input.form.accountId,
      form_id: input.form.id,
      resume_token: resumeToken,
      payload: values,
      step_index: stepIndex,
      contact_email: contactEmail,
      expires_at: expiresAt,
    });

    if (insertError) {
      throw new Error(insertError.message ?? 'Could not save draft');
    }
  }

  const resumeUrl = buildFormResumeUrl({
    shareToken: input.form.shareToken,
    resumeToken,
    siteUrl: input.siteUrl,
    embed: input.embed,
    listingId: input.listingId,
    propertyId: input.propertyId,
  });

  const shouldEmail = Boolean(contactEmail) && (createdNew || !previousEmail);
  let emailed = false;
  if (contactEmail && shouldEmail) {
    emailed = await sendFormResumeEmail({
      form: input.form,
      to: contactEmail,
      resumeUrl,
    });
  }

  return {
    draft: {
      resumeToken,
      values,
      stepIndex,
      contactEmail,
    },
    resumeUrl,
    emailed,
    email: contactEmail,
  };
}

export async function consumePublicFormDraft(
  admin: SupabaseClient,
  input: { formId: string; resumeToken?: string | null },
): Promise<void> {
  if (!isLikelyResumeToken(input.resumeToken)) return;

  const { error } = await fromTable(admin, 'workspace_form_drafts')
    .delete()
    .eq('resume_token', input.resumeToken)
    .eq('form_id', input.formId);

  if (error) {
    const logger = await getLogger();
    logger.warn(
      {
        name: 'workspace-form-draft',
        formId: input.formId,
        error: error.message,
      },
      'Could not delete form draft after submit',
    );
  }
}

async function sendFormResumeEmail(input: {
  form: PublicWorkspaceForm;
  to: string;
  resumeUrl: string;
}): Promise<boolean> {
  const logger = await getLogger();
  const formName = input.form.name.trim() || 'form';
  const innerHtml = `
<p style="margin:0 0 12px;">You saved your answers for <strong>${escapeEmailHtml(formName)}</strong>.</p>
<p style="margin:0 0 16px;">Use the link below to continue where you left off. The link expires in 30 days and stops working after you submit the form.</p>
<p style="margin:0;"><a href="${escapeEmailHtml(input.resumeUrl)}" style="color:#FF5C34;font-weight:700;">Continue the form</a></p>
`.trim();

  try {
    await sendClientFacingEmail({
      type: 'form_resume',
      accountId: input.form.accountId,
      feature: 'other',
      accountName: input.form.accountName,
      brandContactEmail: input.form.brand.contact_email,
      mail: {
        to: input.to,
        subject: `Continue ${formName}`,
        html: wrapEmailHtmlWithBrand({
          brand: input.form.brand as AccountBrandResolved,
          innerHtml,
        }),
      },
      metadata: {
        form_id: input.form.id,
        kind: 'form_resume',
      },
    });
    return true;
  } catch (error) {
    logger.warn(
      {
        name: 'workspace-form-draft',
        formId: input.form.id,
        error: error instanceof Error ? error.message : String(error),
      },
      'Could not email form resume link',
    );
    return false;
  }
}

export function publicOriginFromRequest(request: Request): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  if (env) return env;

  const host =
    request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  if (host) return `${proto}://${host}`;
  return 'https://ozer.so';
}
