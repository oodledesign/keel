'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  mapSystemTemplate,
  mapUserTemplate,
} from '~/lib/content-templates/map-rows';
import {
  DeleteUserReplyPresetSchema,
  DuplicateSystemToUserSchema,
  SetUserReplyPresetDefaultSchema,
  UpsertUserReplyPresetSchema,
} from '~/lib/content-templates/schemas';
import { MAX_USER_REPLY_PRESETS } from '~/lib/content-templates/types';

function revalidatePersonal() {
  revalidatePath('/home/email');
  revalidatePath('/app/email');
  revalidatePath('/home/settings');
  revalidatePath('/app/settings');
}

export const listUserReplyPresetsAction = enhanceAction(
  async (_data, user) => {
    const client = getSupabaseServerClient();
    const { data: rows, error } = await client
      .from('user_content_templates')
      .select('*')
      .eq('user_id', user.id)
      .eq('kind', 'email_reply')
      .order('is_default', { ascending: false })
      .order('updated_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (rows ?? []).map((row) =>
      mapUserTemplate(row as Record<string, unknown>),
    );
  },
  { auth: true, schema: z.object({}).optional() },
);

export const upsertUserReplyPresetAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    if (!data.id) {
      const { count } = await client
        .from('user_content_templates')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if ((count ?? 0) >= MAX_USER_REPLY_PRESETS) {
        throw new Error(
          `Maximum of ${MAX_USER_REPLY_PRESETS} reply presets reached`,
        );
      }
    }

    if (data.isDefault) {
      await client
        .from('user_content_templates')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .eq('kind', 'email_reply');
    }

    const payload = {
      user_id: user.id,
      kind: 'email_reply' as const,
      name: data.name.trim(),
      body_text: data.bodyText.trim(),
      is_default: data.isDefault ?? false,
      source_system_template_id: data.sourceSystemTemplateId ?? null,
    };

    if (data.id) {
      const { error } = await client
        .from('user_content_templates')
        .update(payload)
        .eq('id', data.id)
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await client
        .from('user_content_templates')
        .insert(payload);
      if (error) throw new Error(error.message);
    }

    revalidatePersonal();
    return { ok: true as const };
  },
  { auth: true, schema: UpsertUserReplyPresetSchema },
);

export const deleteUserReplyPresetAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();
    const { error } = await client
      .from('user_content_templates')
      .delete()
      .eq('id', data.id)
      .eq('user_id', user.id);
    if (error) throw new Error(error.message);
    revalidatePersonal();
    return { ok: true as const };
  },
  { auth: true, schema: DeleteUserReplyPresetSchema },
);

export const setUserReplyPresetDefaultAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();
    await client
      .from('user_content_templates')
      .update({ is_default: false })
      .eq('user_id', user.id)
      .eq('kind', 'email_reply');

    const { error } = await client
      .from('user_content_templates')
      .update({ is_default: true })
      .eq('id', data.id)
      .eq('user_id', user.id);

    if (error) throw new Error(error.message);
    revalidatePersonal();
    return { ok: true as const };
  },
  { auth: true, schema: SetUserReplyPresetDefaultSchema },
);

export const duplicateSystemReplyToUserAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();
    const { data: system, error: loadError } = await client
      .from('content_templates')
      .select('*')
      .eq('id', data.systemTemplateId)
      .eq('kind', 'email_reply')
      .eq('is_active', true)
      .maybeSingle();

    if (loadError || !system) {
      throw new Error(loadError?.message ?? 'System preset not found');
    }

    const mapped = mapSystemTemplate(system as Record<string, unknown>);

    const { count } = await client
      .from('user_content_templates')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if ((count ?? 0) >= MAX_USER_REPLY_PRESETS) {
      throw new Error(
        `Maximum of ${MAX_USER_REPLY_PRESETS} reply presets reached`,
      );
    }

    const { error } = await client.from('user_content_templates').insert({
      user_id: user.id,
      kind: 'email_reply',
      name: data.name?.trim() || mapped.name,
      body_text: mapped.bodyText,
      is_default: false,
      source_system_template_id: mapped.id,
    });

    if (error) throw new Error(error.message);
    revalidatePersonal();
    return { ok: true as const };
  },
  { auth: true, schema: DuplicateSystemToUserSchema },
);
