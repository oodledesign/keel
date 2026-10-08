import 'server-only';

import { NextResponse } from 'next/server';

import { z } from 'zod';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { authenticateRecorderRequest } from '~/lib/api-tokens/recorder-auth';
import type { ValidatedApiToken } from '~/lib/api-tokens/types';
import { NativeReportMessageBodySchema } from '~/lib/messages/message-safety-shared';
import { NativeHttpError, nativeJsonError } from '~/lib/native/http';
import {
  NativeComposeTypeSchema,
  NativeSendMessageBodySchema,
} from '~/lib/native/messages';
import {
  findNativeWorkspace,
  loadNativeWorkspaces,
} from '~/lib/native/workspace';

/**
 * Mac Assistant (OzerAssistant) messaging. Same contracts as the iOS
 * `/api/native/v1/messages` routes, but authenticated with a recorder token
 * and scoped by `account_id` (defaults to the token's workspace).
 */

const AccountIdSchema = z.string().trim().min(1).max(200).optional();

export const RecorderCreateThreadBodySchema = z.object({
  account_id: AccountIdSchema,
  type: NativeComposeTypeSchema,
  title: z.string().max(180).nullish(),
  job_id: z
    .union([z.string().uuid(), z.literal('')])
    .nullish()
    .transform((value) => value || null),
  client_id: z
    .union([z.string().uuid(), z.literal('')])
    .nullish()
    .transform((value) => value || null),
  member_user_ids: z.array(z.string().uuid()).max(50).optional(),
  client_ids: z.array(z.string().uuid()).max(50).optional(),
  contact_ids: z.array(z.string().uuid()).max(50).optional(),
});

export const RecorderSendMessageBodySchema = NativeSendMessageBodySchema.omit({
  workspace: true,
}).extend({
  account_id: AccountIdSchema,
  image_url: NativeSendMessageBodySchema.shape.image_url.nullable(),
});

export const RecorderAccountBodySchema = z.object({
  account_id: AccountIdSchema,
});

export const RecorderReportMessageBodySchema =
  NativeReportMessageBodySchema.omit({ workspace: true }).extend({
    account_id: AccountIdSchema,
  });

export async function resolveRecorderWorkspace(
  auth: ValidatedApiToken,
  accountRef: string | null | undefined,
) {
  const admin = getSupabaseServerAdminClient();
  const workspaces = await loadNativeWorkspaces(admin, auth.user_id);
  const workspace = findNativeWorkspace(
    workspaces,
    accountRef?.trim() || auth.account_id,
  );

  if (!workspace) {
    throw new NativeHttpError(403, 'You are not a member of this workspace');
  }

  return workspace;
}

export function recorderAccountRef(request: Request) {
  const params = new URL(request.url).searchParams;
  return (
    params.get('account_id')?.trim() || params.get('workspace')?.trim() || null
  );
}

export async function parseRecorderBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<z.infer<T>> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new NativeHttpError(400, 'Invalid JSON body');
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new NativeHttpError(400, 'Invalid request body');
  }

  return parsed.data;
}

export async function withRecorderAuth(
  request: Request,
  logName: string,
  handler: (auth: ValidatedApiToken) => Promise<Response>,
) {
  const auth = await authenticateRecorderRequest(request, {
    touchLastUsed: true,
  });
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    return await handler(auth);
  } catch (error) {
    if (error instanceof NativeHttpError) {
      return nativeJsonError(error.status, error.message);
    }

    console.error(`[${logName}]`, error);
    return nativeJsonError(500, 'Internal server error');
  }
}
