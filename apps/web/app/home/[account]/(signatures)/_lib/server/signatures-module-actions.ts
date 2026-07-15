'use server';

import { revalidatePath } from 'next/cache';

import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { isRedirectError } from 'next/dist/client/components/redirect-error';

import pathsConfig from '~/config/paths.config';
import { isSignaturesModuleEnabled } from '~/home/[account]/_lib/server/account-modules';
import { loadAccountBranchById } from '~/lib/brand/account-branches';
import {
  disconnectGoogleWorkspace,
  connectGoogleWorkspace,
} from '~/lib/signatures/google-workspace';
import {
  createIntegrationConnectInvite,
  integrationConnectUrl,
  revokeIntegrationConnectInvite,
} from '~/lib/signatures/integration-invite';
import { getSignaturesSupabaseClient } from '~/lib/signatures/graph';
import { buildSignatureInstallEmail } from '~/lib/signatures/install-instructions';
import { ensureSignaturePreviewShare } from '~/lib/signatures/preview-share';
import {
  pushAllSignatures,
  pushSignatureToStaff,
  syncStaffForAccount,
} from '~/lib/signatures/signatures-provider';
import { sendPlatformEmail } from '~/lib/server/send-platform-email';

import {
  deleteSignatureAssetActionSchema,
  disconnectM365ActionSchema,
  connectGoogleWorkspaceActionSchema,
  disconnectGoogleActionSchema,
  createIntegrationInviteActionSchema,
  createSignaturePreviewShareActionSchema,
  revokeIntegrationInviteActionSchema,
  pushAllActionSchema,
  pushStaffActionSchema,
  saveTemplateActionSchema,
  sendSignatureInstallInstructionsActionSchema,
  syncStaffActionSchema,
  upsertSignatureAssetActionSchema,
  updateStaffActionSchema,
  updateSignatureChangeRequestStatusActionSchema,
  bulkUpdateStaffActionSchema,
} from '../schema/signatures-module.schema';
import { updateSignatureChangeRequestStatus } from '~/lib/signatures/change-requests';
import { uploadBadgeFromDataUrl, uploadPhotoFromDataUrl } from './signatures-data';

function workPath(template: string, accountSlug: string) {
  return template.replace('[account]', accountSlug);
}

function staffDetailPath(accountSlug: string, staffId: string) {
  return pathsConfig.app.accountSignaturesStaffDetail
    .replace('[account]', accountSlug)
    .replace('[staffId]', staffId);
}

function templateDetailPath(accountSlug: string, templateId: string) {
  return pathsConfig.app.accountSignaturesTemplateDetail
    .replace('[account]', accountSlug)
    .replace('[templateId]', templateId);
}

async function assertSignaturesAdmin(accountId: string, userId: string) {
  const client = getSupabaseServerClient() as SupabaseClient;
  const { data: membership } = await client
    .from('accounts_memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  const role = membership?.account_role;
  if (role !== 'owner' && role !== 'admin') {
    throw new Error('Account admin required');
  }

  const { data: rows } = await client
    .from('account_module_settings')
    .select('module_key, enabled')
    .eq('account_id', accountId);

  const moduleSettings = Object.fromEntries(
    (rows ?? []).map((row) => [row.module_key, row.enabled]),
  ) as Record<string, boolean>;

  if (!isSignaturesModuleEnabled(moduleSettings)) {
    throw new Error('Signatures is disabled for this account');
  }

  const { data: account } = await client
    .from('accounts')
    .select('slug')
    .eq('id', accountId)
    .maybeSingle();

  if (!account?.slug) {
    throw new Error('Account not found');
  }

  return { accountSlug: account.slug as string };
}

export const syncSignaturesStaff = enhanceAction(
  async (input, user) => {
    const { accountSlug } = await assertSignaturesAdmin(input.accountId, user.id);
    const result = await syncStaffForAccount(input.accountId);

    revalidatePath(workPath(pathsConfig.app.accountSignaturesDashboard, accountSlug));
    revalidatePath(workPath(pathsConfig.app.accountSignaturesStaff, accountSlug));
    return result;
  },
  { schema: syncStaffActionSchema },
);

export const pushAllSignaturesAction = enhanceAction(
  async (input, user) => {
    const { accountSlug } = await assertSignaturesAdmin(input.accountId, user.id);
    const result = await pushAllSignatures(input.accountId, user.id);

    revalidatePath(workPath(pathsConfig.app.accountSignaturesDashboard, accountSlug));
    revalidatePath(workPath(pathsConfig.app.accountSignaturesStaff, accountSlug));
    return result;
  },
  { schema: pushAllActionSchema },
);

export const pushStaffSignatureAction = enhanceAction(
  async (input, user) => {
    const { accountSlug } = await assertSignaturesAdmin(input.accountId, user.id);
    const db = getSignaturesSupabaseClient();
    const { data: staff } = await db
      .from('staff')
      .select('id')
      .eq('id', input.staffId)
      .eq('account_id', input.accountId)
      .maybeSingle();

    if (!staff) {
      throw new Error('Staff member not found');
    }

    const result = await pushSignatureToStaff(input.staffId);

    revalidatePath(workPath(pathsConfig.app.accountSignaturesDashboard, accountSlug));
    revalidatePath(workPath(pathsConfig.app.accountSignaturesStaff, accountSlug));
    revalidatePath(staffDetailPath(accountSlug, input.staffId));
    return result;
  },
  { schema: pushStaffActionSchema },
);

export const updateSignatureStaff = enhanceAction(
  async (input, user) => {
    const { accountSlug } = await assertSignaturesAdmin(input.accountId, user.id);
    const db = getSignaturesSupabaseClient();

    let photoUrl: string | null | undefined;
    if (input.photoDataUrl) {
      photoUrl = await uploadPhotoFromDataUrl(
        input.accountId,
        input.staffId,
        input.photoDataUrl,
      );
    }

    let branchName: string | null = null;
    if (input.branch_id) {
      const branch = await loadAccountBranchById(input.accountId, input.branch_id);
      if (!branch) {
        throw new Error('Branch not found');
      }
      branchName = branch.name;
    }

    const update = {
      full_name: input.full_name,
      job_title: input.job_title,
      department: input.department,
      phone_direct: input.phone_direct,
      phone_mobile: input.phone_mobile,
      branch_id: input.branch_id ?? null,
      branch: branchName,
      signature_email: input.signature_email,
      ...(photoUrl ? { photo_url: photoUrl } : {}),
    };

    const { data: staff, error } = await db
      .from('staff')
      .update(update)
      .eq('id', input.staffId)
      .eq('account_id', input.accountId)
      .select('id')
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!staff) {
      throw new Error('Staff member not found');
    }

    await db.from('staff_templates').delete().eq('staff_id', input.staffId);

    if (input.templateId) {
      const { data: template } = await db
        .from('templates')
        .select('id')
        .eq('id', input.templateId)
        .eq('account_id', input.accountId)
        .maybeSingle();

      if (!template) {
        throw new Error('Template not found');
      }

      const { error: linkError } = await db.from('staff_templates').insert({
        staff_id: input.staffId,
        template_id: input.templateId,
      });

      if (linkError) {
        throw new Error(linkError.message);
      }
    }

    revalidatePath(workPath(pathsConfig.app.accountSignaturesDashboard, accountSlug));
    revalidatePath(workPath(pathsConfig.app.accountSignaturesStaff, accountSlug));
    revalidatePath(staffDetailPath(accountSlug, input.staffId));
    return { ok: true as const };
  },
  { schema: updateStaffActionSchema },
);

export const bulkUpdateSignatureStaff = enhanceAction(
  async (input, user) => {
    const { accountSlug } = await assertSignaturesAdmin(input.accountId, user.id);
    const db = getSignaturesSupabaseClient();

    const branchCache = new Map<string, string>();
    for (const row of input.rows) {
      if (row.branch_id && !branchCache.has(row.branch_id)) {
        const branch = await loadAccountBranchById(input.accountId, row.branch_id);
        if (!branch) {
          throw new Error(`Branch not found for staff ${row.staffId}`);
        }
        branchCache.set(row.branch_id, branch.name);
      }
    }

    let updated = 0;

    for (const row of input.rows) {
      let photoUrl: string | null | undefined;
      if (row.photoDataUrl) {
        photoUrl = await uploadPhotoFromDataUrl(
          input.accountId,
          row.staffId,
          row.photoDataUrl,
        );
      }

      const update = {
        full_name: row.full_name,
        job_title: row.job_title,
        department: row.department,
        phone_direct: row.phone_direct,
        phone_mobile: row.phone_mobile,
        branch_id: row.branch_id,
        branch: row.branch_id ? (branchCache.get(row.branch_id) ?? null) : null,
        signature_email: row.signature_email,
        ...(photoUrl ? { photo_url: photoUrl } : {}),
      };

      const { data: staff, error } = await db
        .from('staff')
        .update(update)
        .eq('id', row.staffId)
        .eq('account_id', input.accountId)
        .select('id')
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }
      if (!staff) {
        throw new Error(`Staff member not found: ${row.staffId}`);
      }

      await db.from('staff_templates').delete().eq('staff_id', row.staffId);

      if (row.templateId) {
        const { data: template } = await db
          .from('templates')
          .select('id')
          .eq('id', row.templateId)
          .eq('account_id', input.accountId)
          .maybeSingle();

        if (!template) {
          throw new Error(`Template not found for staff ${row.staffId}`);
        }

        const { error: linkError } = await db.from('staff_templates').insert({
          staff_id: row.staffId,
          template_id: row.templateId,
        });

        if (linkError) {
          throw new Error(linkError.message);
        }
      }

      updated += 1;
    }

    revalidatePath(workPath(pathsConfig.app.accountSignaturesDashboard, accountSlug));
    revalidatePath(workPath(pathsConfig.app.accountSignaturesStaff, accountSlug));
    return { ok: true as const, updated };
  },
  { schema: bulkUpdateStaffActionSchema },
);

export const saveSignatureTemplate = enhanceAction(
  async (input, user) => {
    const { accountSlug } = await assertSignaturesAdmin(input.accountId, user.id);
    const db = getSignaturesSupabaseClient();

    if (input.is_default) {
      await db
        .from('templates')
        .update({ is_default: false })
        .eq('account_id', input.accountId);
    }

    const { error } = await db
      .from('templates')
      .update({
        name: input.name,
        html_template: input.html_template,
        is_default: input.is_default,
      })
      .eq('id', input.templateId)
      .eq('account_id', input.accountId);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(workPath(pathsConfig.app.accountSignaturesTemplates, accountSlug));
    revalidatePath(templateDetailPath(accountSlug, input.templateId));
    return { ok: true as const };
  },
  { schema: saveTemplateActionSchema },
);

export const disconnectMicrosoft365 = enhanceAction(
  async (input, user) => {
    const { accountSlug } = await assertSignaturesAdmin(input.accountId, user.id);
    const db = getSignaturesSupabaseClient();
    const { error } = await db
      .from('ms_connections')
      .delete()
      .eq('account_id', input.accountId);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(workPath(pathsConfig.app.accountSignaturesSettings, accountSlug));
    revalidatePath(workPath(pathsConfig.app.accountSignaturesDashboard, accountSlug));
    return { ok: true as const };
  },
  { schema: disconnectM365ActionSchema },
);

function actionFailure(error: unknown, fallback: string) {
  console.error('[signatures-module-actions]', error);
  if (error instanceof Error && error.message) {
    return { ok: false as const, error: error.message };
  }
  return { ok: false as const, error: fallback };
}

export type ConnectGoogleWorkspaceResult =
  | { ok: true }
  | { ok: false; error: string };

const connectGoogleWorkspaceActionImpl = enhanceAction(
  async (input, user) => {
    try {
      const { accountSlug } = await assertSignaturesAdmin(input.accountId, user.id);
      await connectGoogleWorkspace({
        accountId: input.accountId,
        primaryDomain: input.primaryDomain,
        delegatedAdminEmail: input.delegatedAdminEmail,
        connectedBy: user.id,
      });

      revalidatePath(workPath(pathsConfig.app.accountSignaturesSettings, accountSlug));
      revalidatePath(
        workPath(pathsConfig.app.accountSignaturesIntegrations, accountSlug),
      );
      revalidatePath(workPath(pathsConfig.app.accountSignaturesDashboard, accountSlug));
      revalidatePath(workPath(pathsConfig.app.accountSignaturesStaff, accountSlug));
      return { ok: true as const };
    } catch (error) {
      return actionFailure(error, 'Failed to connect Google Workspace');
    }
  },
  { schema: connectGoogleWorkspaceActionSchema },
);

export async function connectGoogleWorkspaceAction(
  input: z.infer<typeof connectGoogleWorkspaceActionSchema>,
): Promise<ConnectGoogleWorkspaceResult> {
  try {
    return await connectGoogleWorkspaceActionImpl(input);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    return actionFailure(error, 'Invalid Google Workspace connection request');
  }
}

export const disconnectGoogleWorkspaceAction = enhanceAction(
  async (input, user) => {
    const { accountSlug } = await assertSignaturesAdmin(input.accountId, user.id);
    await disconnectGoogleWorkspace(input.accountId);

    revalidatePath(workPath(pathsConfig.app.accountSignaturesSettings, accountSlug));
    revalidatePath(workPath(pathsConfig.app.accountSignaturesDashboard, accountSlug));
    return { ok: true as const };
  },
  { schema: disconnectGoogleActionSchema },
);

export const upsertSignatureAssetAction = enhanceAction(
  async (input, user) => {
    const { accountSlug } = await assertSignaturesAdmin(input.accountId, user.id);
    const db = getSignaturesSupabaseClient();

    const scope = input.scope;
    const department =
      scope === 'department' ? (input.department?.trim() ?? null) : null;
    const branchId = scope === 'branch' ? (input.branchId ?? null) : null;

    if (scope === 'branch' && branchId) {
      const branch = await loadAccountBranchById(input.accountId, branchId);
      if (!branch) {
        throw new Error('Branch not found');
      }
    }

    let imageUrl: string | null = null;
    let body: string | null = null;

    if (input.kind === 'custom_text') {
      body = input.body?.trim() ?? null;
      if (!body) {
        throw new Error('Enter the shared text');
      }
    } else {
      imageUrl = input.award_badge_url?.trim() || null;
      if (input.badgeDataUrl?.startsWith('data:image/')) {
        imageUrl = await uploadBadgeFromDataUrl(
          input.accountId,
          input.label || department || 'badge',
          input.badgeDataUrl,
        );
      }
      if (!imageUrl) {
        throw new Error('Upload a badge image or paste a valid image URL');
      }
    }

    const payload = {
      account_id: input.accountId,
      kind: input.kind,
      scope,
      department,
      branch_id: branchId,
      label: input.label.trim(),
      body,
      image_url: imageUrl,
      sort_order: input.sortOrder ?? 0,
    };

    if (input.id) {
      const { error } = await db
        .from('signature_assets')
        .update(payload)
        .eq('id', input.id)
        .eq('account_id', input.accountId);
      if (error) {
        throw new Error(error.message);
      }
    } else {
      const { error } = await db.from('signature_assets').insert(payload);
      if (error) {
        throw new Error(error.message);
      }
    }

    revalidatePath(
      workPath(pathsConfig.app.accountSignaturesSettings, accountSlug),
    );
    revalidatePath(
      workPath(pathsConfig.app.accountSignaturesCustomData, accountSlug),
    );
    revalidatePath(
      workPath(pathsConfig.app.accountSignaturesStaff, accountSlug),
    );
    revalidatePath(
      workPath(pathsConfig.app.accountSignaturesDashboard, accountSlug),
    );
    revalidatePath(
      workPath(pathsConfig.app.accountSignaturesTemplates, accountSlug),
    );
    return { ok: true as const };
  },
  { schema: upsertSignatureAssetActionSchema },
);

export const deleteSignatureAssetAction = enhanceAction(
  async (input, user) => {
    const { accountSlug } = await assertSignaturesAdmin(input.accountId, user.id);
    const db = getSignaturesSupabaseClient();
    const { error } = await db
      .from('signature_assets')
      .delete()
      .eq('account_id', input.accountId)
      .eq('id', input.assetId);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(
      workPath(pathsConfig.app.accountSignaturesSettings, accountSlug),
    );
    revalidatePath(
      workPath(pathsConfig.app.accountSignaturesStaff, accountSlug),
    );
    revalidatePath(
      workPath(pathsConfig.app.accountSignaturesDashboard, accountSlug),
    );
    return { ok: true as const };
  },
  { schema: deleteSignatureAssetActionSchema },
);

export const createSignaturesIntegrationInvite = enhanceAction(
  async (input, user) => {
    await assertSignaturesAdmin(input.accountId, user.id);
    const { token, invite } = await createIntegrationConnectInvite({
      accountId: input.accountId,
      provider: input.provider,
      createdBy: user.id,
      label: input.label,
      expiresInDays: input.expiresInDays,
    });

    return {
      inviteId: invite.id,
      url: integrationConnectUrl(token),
      provider: invite.provider,
      expiresAt: invite.expires_at,
    };
  },
  { schema: createIntegrationInviteActionSchema },
);

export const revokeSignaturesIntegrationInvite = enhanceAction(
  async (input, user) => {
    const { accountSlug } = await assertSignaturesAdmin(input.accountId, user.id);
    await revokeIntegrationConnectInvite({
      accountId: input.accountId,
      inviteId: input.inviteId,
    });
    revalidatePath(workPath(pathsConfig.app.accountSignaturesSettings, accountSlug));
    return { ok: true as const };
  },
  { schema: revokeIntegrationInviteActionSchema },
);

export const createSignaturePreviewShareAction = enhanceAction(
  async (input, user) => {
    await assertSignaturesAdmin(input.accountId, user.id);

    const db = getSignaturesSupabaseClient();
    const { data: template, error: templateError } = await db
      .from('templates')
      .select('id')
      .eq('id', input.templateId)
      .eq('account_id', input.accountId)
      .maybeSingle();

    if (templateError) {
      throw new Error(templateError.message);
    }
    if (!template) {
      throw new Error('Template not found');
    }

    if (input.staffId) {
      const { data: staff, error: staffError } = await db
        .from('staff')
        .select('id')
        .eq('id', input.staffId)
        .eq('account_id', input.accountId)
        .maybeSingle();

      if (staffError) {
        throw new Error(staffError.message);
      }
      if (!staff) {
        throw new Error('Staff member not found');
      }
    }

    return ensureSignaturePreviewShare({
      accountId: input.accountId,
      templateId: input.templateId,
      staffId: input.staffId ?? null,
      createdBy: user.id,
    });
  },
  { schema: createSignaturePreviewShareActionSchema },
);

export const sendSignatureInstallInstructionsAction = enhanceAction(
  async (input, user) => {
    const { accountSlug } = await assertSignaturesAdmin(
      input.accountId,
      user.id,
    );

    const sender = process.env.EMAIL_SENDER?.trim();
    if (!sender) {
      throw new Error('EMAIL_SENDER is not configured');
    }

    const db = getSignaturesSupabaseClient();
    const { data: staff, error: staffError } = await db
      .from('staff')
      .select('id, email, signature_email, full_name')
      .eq('id', input.staffId)
      .eq('account_id', input.accountId)
      .maybeSingle();

    if (staffError) {
      throw new Error(staffError.message);
    }
    if (!staff) {
      throw new Error('Staff member not found');
    }

    let templateId = input.templateId ?? null;
    if (!templateId) {
      const { data: assignment, error: assignmentError } = await db
        .from('staff_templates')
        .select('template_id')
        .eq('staff_id', input.staffId)
        .maybeSingle();

      if (assignmentError) {
        throw new Error(assignmentError.message);
      }
      templateId = (assignment?.template_id as string | undefined) ?? null;
    }

    if (!templateId) {
      throw new Error('Assign a template before sending install instructions');
    }

    const { data: template, error: templateError } = await db
      .from('templates')
      .select('id')
      .eq('id', templateId)
      .eq('account_id', input.accountId)
      .maybeSingle();

    if (templateError) {
      throw new Error(templateError.message);
    }
    if (!template) {
      throw new Error('Template not found');
    }

    const share = await ensureSignaturePreviewShare({
      accountId: input.accountId,
      templateId,
      staffId: input.staffId,
      createdBy: user.id,
    });

    const client = getSupabaseServerClient() as SupabaseClient;
    const { data: account } = await client
      .from('accounts')
      .select('name')
      .eq('id', input.accountId)
      .maybeSingle();

    const to =
      (staff.signature_email as string | null)?.trim() ||
      (staff.email as string).trim();

    const email = buildSignatureInstallEmail({
      recipientName: (staff.full_name as string | null) ?? null,
      accountName: (account?.name as string | null | undefined) ?? accountSlug,
      installUrl: share.url,
    });

    await sendPlatformEmail({
      type: 'signature_install',
      accountId: input.accountId,
      mail: {
        to,
        from: sender,
        subject: email.subject,
        html: email.html,
        text: email.text,
      },
      metadata: {
        staffId: input.staffId,
        templateId,
        previewToken: share.token,
      },
    });

    return { ok: true as const, to, url: share.url };
  },
  { schema: sendSignatureInstallInstructionsActionSchema },
);

export const updateSignatureChangeRequestStatusAction = enhanceAction(
  async (input, user) => {
    const { accountSlug } = await assertSignaturesAdmin(
      input.accountId,
      user.id,
    );

    await updateSignatureChangeRequestStatus({
      accountId: input.accountId,
      requestId: input.requestId,
      status: input.status,
      resolvedBy: user.id,
    });

    revalidatePath(
      workPath(pathsConfig.app.accountSignaturesRequests, accountSlug),
    );
    revalidatePath(
      workPath(pathsConfig.app.accountSignaturesStaff, accountSlug),
    );
    revalidatePath(
      workPath(pathsConfig.app.accountSignaturesDashboard, accountSlug),
    );

    return { ok: true as const };
  },
  { schema: updateSignatureChangeRequestStatusActionSchema },
);
