import type {
  VoiceProfile,
  VoiceSource,
  VoiceTheme,
} from '~/lib/voice/voice.types';

export function mapVoiceProfile(row: Record<string, unknown>): VoiceProfile {
  return {
    id: row.id as string,
    kind: row.kind as VoiceProfile['kind'],
    ownerUserId: (row.owner_user_id as string | null) ?? null,
    accountId: (row.account_id as string | null) ?? null,
    status: (row.status as VoiceProfile['status']) ?? 'draft',
    guidanceText: (row.guidance_text as string | null) ?? null,
    learnFromSentEmail: Boolean(row.learn_from_sent_email),
    lastDistilledAt: (row.last_distilled_at as string | null) ?? null,
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
  };
}

export function mapVoiceTheme(row: Record<string, unknown>): VoiceTheme {
  const examples = Array.isArray(row.examples)
    ? (row.examples as unknown[]).filter(
        (item): item is string => typeof item === 'string',
      )
    : [];

  return {
    id: row.id as string,
    profileId: row.profile_id as string,
    title: ((row.title as string | null) ?? 'Theme').trim() || 'Theme',
    description: ((row.description as string | null) ?? '').trim(),
    examples,
    weight: Number(row.weight ?? 0),
    source: (row.source as VoiceTheme['source']) ?? 'manual',
  };
}

export function mapVoiceSource(row: Record<string, unknown>): VoiceSource {
  return {
    id: row.id as string,
    profileId: row.profile_id as string,
    type: row.type as VoiceSource['type'],
    title: ((row.title as string | null) ?? 'Sample').trim() || 'Sample',
    contentText: ((row.content_text as string | null) ?? '').trim(),
    included: row.included !== false,
    externalRef: (row.external_ref as string | null) ?? null,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
  };
}
