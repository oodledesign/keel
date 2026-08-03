'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { distillVoiceProfile } from '~/lib/voice/distill-voice-profile';
import { ensureVoiceProfile } from '~/lib/voice/ensure-voice-profile';
import { sampleSentEmailSources } from '~/lib/voice/sample-sent-email-sources';
import {
  VOICE_MAX_SOURCES,
  VOICE_MAX_SOURCE_CHARS,
} from '~/lib/voice/voice.types';

const ProfileScopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('personal') }),
  z.object({
    kind: z.literal('brand'),
    accountId: z.string().uuid(),
    accountSlug: z.string().min(1).optional(),
  }),
]);

async function resolveProfileId(
  scope: z.infer<typeof ProfileScopeSchema>,
  userId: string,
) {
  const client = getSupabaseServerClient();
  if (scope.kind === 'personal') {
    const profile = await ensureVoiceProfile(client, {
      kind: 'personal',
      userId,
    });
    return { client, profileId: profile.id, scope };
  }
  const profile = await ensureVoiceProfile(client, {
    kind: 'brand',
    accountId: scope.accountId,
  });
  return { client, profileId: profile.id, scope };
}

function revalidateVoicePaths(scope: z.infer<typeof ProfileScopeSchema>) {
  revalidatePath('/home/settings/tone');
  revalidatePath('/app/settings/tone');
  if (scope.kind === 'brand' && scope.accountSlug) {
    revalidatePath(`/home/${scope.accountSlug}/settings/brand-voice`);
    revalidatePath(`/app/${scope.accountSlug}/settings/brand-voice`);
  }
}

export const addVoicePasteSourceAction = enhanceAction(
  async (data, user) => {
    const { client, profileId, scope } = await resolveProfileId(
      data.scope,
      user.id,
    );

    const { count } = await client
      .from('voice_sources')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', profileId);

    if ((count ?? 0) >= VOICE_MAX_SOURCES) {
      throw new Error(`Maximum of ${VOICE_MAX_SOURCES} samples reached`);
    }

    const content = data.content.trim().slice(0, VOICE_MAX_SOURCE_CHARS);
    if (content.length < 20) {
      throw new Error('Paste a longer writing sample (at least 20 characters)');
    }

    const { error } = await client.from('voice_sources').insert({
      profile_id: profileId,
      type: 'paste',
      title: data.title.trim().slice(0, 120) || 'Pasted sample',
      content_text: content,
      included: true,
    });

    if (error) throw new Error(error.message);
    revalidateVoicePaths(scope);
    return { ok: true as const };
  },
  {
    auth: true,
    schema: z.object({
      scope: ProfileScopeSchema,
      title: z.string().max(120).default('Pasted sample'),
      content: z
        .string()
        .min(20)
        .max(VOICE_MAX_SOURCE_CHARS + 1000),
    }),
  },
);

export const addVoiceUploadTextAction = enhanceAction(
  async (data, user) => {
    const { client, profileId, scope } = await resolveProfileId(
      data.scope,
      user.id,
    );

    const { count } = await client
      .from('voice_sources')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', profileId);

    if ((count ?? 0) >= VOICE_MAX_SOURCES) {
      throw new Error(`Maximum of ${VOICE_MAX_SOURCES} samples reached`);
    }

    const content = data.content.trim().slice(0, VOICE_MAX_SOURCE_CHARS);
    if (content.length < 20) {
      throw new Error('Could not read enough text from that file');
    }

    const { error } = await client.from('voice_sources').insert({
      profile_id: profileId,
      type: 'upload',
      title: data.title.trim().slice(0, 120) || 'Uploaded sample',
      content_text: content,
      included: true,
    });

    if (error) throw new Error(error.message);
    revalidateVoicePaths(scope);
    return { ok: true as const };
  },
  {
    auth: true,
    schema: z.object({
      scope: ProfileScopeSchema,
      title: z.string().max(120),
      content: z
        .string()
        .min(20)
        .max(VOICE_MAX_SOURCE_CHARS + 1000),
    }),
  },
);

export const setVoiceSourceIncludedAction = enhanceAction(
  async (data, user) => {
    const { client, scope } = await resolveProfileId(data.scope, user.id);
    const { error } = await client
      .from('voice_sources')
      .update({ included: data.included })
      .eq('id', data.sourceId)
      .eq('profile_id', data.profileId);

    if (error) throw new Error(error.message);
    revalidateVoicePaths(scope);
    return { ok: true as const };
  },
  {
    auth: true,
    schema: z.object({
      scope: ProfileScopeSchema,
      profileId: z.string().uuid(),
      sourceId: z.string().uuid(),
      included: z.boolean(),
    }),
  },
);

export const deleteVoiceSourceAction = enhanceAction(
  async (data, user) => {
    const { client, scope } = await resolveProfileId(data.scope, user.id);
    const { error } = await client
      .from('voice_sources')
      .delete()
      .eq('id', data.sourceId)
      .eq('profile_id', data.profileId);

    if (error) throw new Error(error.message);
    revalidateVoicePaths(scope);
    return { ok: true as const };
  },
  {
    auth: true,
    schema: z.object({
      scope: ProfileScopeSchema,
      profileId: z.string().uuid(),
      sourceId: z.string().uuid(),
    }),
  },
);

export const upsertVoiceThemeAction = enhanceAction(
  async (data, user) => {
    const { client, profileId, scope } = await resolveProfileId(
      data.scope,
      user.id,
    );

    if (data.themeId) {
      const { error } = await client
        .from('voice_themes')
        .update({
          title: data.title.trim(),
          description: data.description.trim(),
          examples: data.examples.map((item) => item.trim()).filter(Boolean),
          source: 'manual',
        })
        .eq('id', data.themeId)
        .eq('profile_id', profileId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await client.from('voice_themes').insert({
        profile_id: profileId,
        title: data.title.trim(),
        description: data.description.trim(),
        examples: data.examples.map((item) => item.trim()).filter(Boolean),
        source: 'manual',
        weight: 5,
      });
      if (error) throw new Error(error.message);
    }

    revalidateVoicePaths(scope);
    return { ok: true as const };
  },
  {
    auth: true,
    schema: z.object({
      scope: ProfileScopeSchema,
      themeId: z.string().uuid().optional(),
      title: z.string().min(1).max(80),
      description: z.string().max(400),
      examples: z.array(z.string().max(240)).max(3).default([]),
    }),
  },
);

export const deleteVoiceThemeAction = enhanceAction(
  async (data, user) => {
    const { client, scope } = await resolveProfileId(data.scope, user.id);
    const { error } = await client
      .from('voice_themes')
      .delete()
      .eq('id', data.themeId)
      .eq('profile_id', data.profileId);

    if (error) throw new Error(error.message);
    revalidateVoicePaths(scope);
    return { ok: true as const };
  },
  {
    auth: true,
    schema: z.object({
      scope: ProfileScopeSchema,
      profileId: z.string().uuid(),
      themeId: z.string().uuid(),
    }),
  },
);

export const updateVoiceGuidanceAction = enhanceAction(
  async (data, user) => {
    const { client, profileId, scope } = await resolveProfileId(
      data.scope,
      user.id,
    );
    const guidance = data.guidanceText.trim() || null;
    const { error } = await client
      .from('voice_profiles')
      .update({
        guidance_text: guidance,
        status: guidance ? 'ready' : 'draft',
      })
      .eq('id', profileId);

    if (error) throw new Error(error.message);

    // Keep email style_notes in sync for personal profiles (one-release bridge).
    if (scope.kind === 'personal' && guidance) {
      await client
        .from('email_assistant_settings')
        .update({ style_notes: guidance })
        .eq('user_id', user.id);
    }

    revalidateVoicePaths(scope);
    return { ok: true as const };
  },
  {
    auth: true,
    schema: z.object({
      scope: ProfileScopeSchema,
      guidanceText: z.string().max(4000),
    }),
  },
);

export const setLearnFromSentEmailAction = enhanceAction(
  async (data, user) => {
    if (data.scope.kind !== 'personal') {
      throw new Error(
        'Sent-email learning is only available for personal voice',
      );
    }

    const { client, profileId, scope } = await resolveProfileId(
      data.scope,
      user.id,
    );

    const { error } = await client
      .from('voice_profiles')
      .update({ learn_from_sent_email: data.enabled })
      .eq('id', profileId);

    if (error) throw new Error(error.message);

    if (data.enabled) {
      const { data: connection } = await client
        .from('google_connections')
        .select('google_email')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      const ownerEmail =
        (
          connection as { google_email?: string | null } | null
        )?.google_email?.trim() || user.email?.trim();

      if (ownerEmail) {
        await sampleSentEmailSources(client, {
          profileId,
          userId: user.id,
          ownerEmail,
        });
      }
    }

    revalidateVoicePaths(scope);
    return { ok: true as const };
  },
  {
    auth: true,
    schema: z.object({
      scope: ProfileScopeSchema,
      enabled: z.boolean(),
    }),
  },
);

export const rebuildVoiceProfileAction = enhanceAction(
  async (data, user) => {
    const { client, profileId, scope } = await resolveProfileId(
      data.scope,
      user.id,
    );

    if (scope.kind === 'personal') {
      const { data: profile } = await client
        .from('voice_profiles')
        .select('learn_from_sent_email')
        .eq('id', profileId)
        .maybeSingle();

      if (
        (profile as { learn_from_sent_email?: boolean } | null)
          ?.learn_from_sent_email
      ) {
        const { data: connection } = await client
          .from('google_connections')
          .select('google_email')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();
        const ownerEmail =
          (
            connection as { google_email?: string | null } | null
          )?.google_email?.trim() || user.email?.trim();
        if (ownerEmail) {
          await sampleSentEmailSources(client, {
            profileId,
            userId: user.id,
            ownerEmail,
          });
        }
      }
    }

    const result = await distillVoiceProfile(client, profileId, {
      replaceManualThemes: data.replaceManualThemes,
    });

    if (scope.kind === 'personal' && result.guidanceText) {
      await client
        .from('email_assistant_settings')
        .update({ style_notes: result.guidanceText })
        .eq('user_id', user.id);
    }

    revalidateVoicePaths(scope);
    return { ok: true as const, ...result };
  },
  {
    auth: true,
    schema: z.object({
      scope: ProfileScopeSchema,
      replaceManualThemes: z.boolean().optional(),
    }),
  },
);
