import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import pathsConfig from '~/config/paths.config';
import { workAccountPath } from '~/home/[account]/_lib/work-account-path';
import { assertWorkspaceMember } from '~/lib/api-tokens/assert-workspace-member';
import { composeContactFullName } from '~/lib/clients/contact-roles';
import { type ExtensionCaptureInput } from '~/lib/extension/capture-schema';
import { createRecorderNote } from '~/lib/recorder/create-note';
import { createRecorderTask } from '~/lib/recorder/create-task';
import { getPersonalAccountId } from '~/lib/recorder/personal-account';

export {
  ExtensionCaptureKinds,
  ExtensionCaptureSchema,
  type ExtensionCaptureInput,
} from '~/lib/extension/capture-schema';

function firstLine(text: string, fallback: string): string {
  const line =
    text
      .split('\n')
      .map((part) => part.trim())
      .find(Boolean) ?? fallback;
  return line.slice(0, 120);
}

function withSourceFooter(body: string, url?: string, pageTitle?: string) {
  const parts = [body.trim()];
  if (pageTitle || url) {
    const label = pageTitle?.trim() || 'Page';
    parts.push(url ? `Source: [${label}](${url})` : `Source: ${label}`);
  }
  return parts.filter(Boolean).join('\n\n');
}

async function resolveAccountId(
  userId: string,
  requested?: string,
): Promise<{ accountId: string; slug: string | null; isPersonal: boolean }> {
  const admin = getSupabaseServerAdminClient();
  let accountId = requested?.trim() || null;
  if (accountId) {
    await assertWorkspaceMember(admin, accountId, userId);
  } else {
    accountId = await getPersonalAccountId(admin, userId);
    if (!accountId) {
      throw new Error('Personal workspace not found');
    }
  }

  const { data: account } = await admin
    .from('accounts')
    .select('slug, is_personal_account')
    .eq('id', accountId)
    .maybeSingle();

  return {
    accountId,
    slug: (account?.slug as string | null) ?? null,
    isPersonal: Boolean(account?.is_personal_account),
  };
}

function splitName(fullName: string): {
  firstName: string;
  lastName: string | null;
} {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0] ?? fullName;
  const lastName = parts.slice(1).join(' ').trim() || null;
  return { firstName, lastName };
}

export async function createExtensionCapture(input: {
  userId: string;
  body: ExtensionCaptureInput;
}): Promise<{
  id: string;
  kind: ExtensionCaptureInput['kind'];
  detail_path: string;
  title: string;
}> {
  const workspace = await resolveAccountId(input.userId, input.body.account_id);

  if (input.body.kind === 'task') {
    const title =
      input.body.title?.trim() ||
      firstLine(input.body.body ?? '', 'Captured task');
    const notes = withSourceFooter(
      input.body.body ?? '',
      input.body.url,
      input.body.page_title,
    );
    const result = await createRecorderTask({
      userId: input.userId,
      accountId: workspace.accountId,
      title,
      notes: notes || null,
    });
    return {
      id: result.id,
      kind: 'task',
      detail_path: result.detail_path ?? pathsConfig.app.personalPlanner,
      title,
    };
  }

  if (input.body.kind === 'note') {
    const content = withSourceFooter(
      input.body.body?.trim() || input.body.title || 'Captured note',
      input.body.url,
      input.body.page_title,
    );
    const result = await createRecorderNote({
      userId: input.userId,
      accountId: workspace.accountId,
      title: input.body.title,
      content,
      source: 'chrome_extension',
    });
    return {
      id: result.id,
      kind: 'note',
      detail_path: result.detail_path,
      title: result.title,
    };
  }

  const admin = getSupabaseServerAdminClient();
  const fullName = composeContactFullName({
    fullName: input.body.title,
    firstName: input.body.title,
  });
  const names = splitName(fullName);
  const notes = withSourceFooter('', input.body.url, input.body.page_title);

  const { data, error } = await admin
    .from('contacts')
    .insert({
      account_id: workspace.accountId,
      user_id: input.userId,
      first_name: names.firstName,
      last_name: names.lastName,
      full_name: fullName,
      email: input.body.email ?? null,
      phone: input.body.phone ?? null,
      notes: notes || null,
    })
    .select('id, full_name')
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? 'Failed to create contact stub');
  }

  const detailPath = workspace.isPersonal
    ? pathsConfig.app.personalPeopleDetail.replace('[personId]', data.id)
    : workspace.slug
      ? `${workAccountPath(pathsConfig.app.accountClients, workspace.slug)}?contact=${data.id}`
      : pathsConfig.app.personalPeople;

  return {
    id: data.id as string,
    kind: 'contact',
    detail_path: detailPath,
    title: ((data.full_name as string | null)?.trim() || fullName) as string,
  };
}
