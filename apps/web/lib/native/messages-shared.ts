import { z } from 'zod';

export const NativeComposeTypeSchema = z.enum([
  'direct',
  'group',
  'job',
  'client',
]);

export const NativeCreateThreadBodySchema = z.object({
  workspace: z.string().min(1),
  type: NativeComposeTypeSchema,
  title: z.string().max(180).optional(),
  job_id: z
    .union([z.string().uuid(), z.literal('')])
    .nullable()
    .optional()
    .transform((value) => value || null),
  client_id: z.string().uuid().optional(),
  member_user_ids: z.array(z.string().uuid()).optional(),
  contact_ids: z.array(z.string().uuid()).optional(),
});

export const NativeIsoDateTimeSchema = z.string().datetime({ offset: true });

export const NativeSendMessageBodySchema = z.object({
  workspace: z.string().min(1),
  body: z.string().max(5000).optional().default(''),
  image_url: z
    .string()
    .url()
    .max(2048)
    .refine((value) => value.startsWith('https://'), {
      message: 'Image URL must use HTTPS',
    })
    .optional(),
  attachments: z
    .array(
      z.object({
        type: z.enum(['note', 'doc']),
        id: z.string().uuid(),
        title: z.string().min(1).max(200),
      }),
    )
    .max(5)
    .optional(),
});

export type NativeComposeThreadType = 'direct' | 'group' | 'job' | 'client';

export type NativeComposePerson = {
  id: string;
  name: string;
};

export type NativeComposeSelection = {
  people: NativeComposePerson[];
  contacts: NativeComposePerson[];
  client: NativeComposePerson | null;
  job: { id: string; title: string } | null;
};

export function inferNativeComposeType(
  selection: NativeComposeSelection,
): NativeComposeThreadType {
  if (selection.client) return 'client';
  if (selection.job) return 'job';
  const others = selection.people.length + selection.contacts.length;
  return others === 1 ? 'direct' : 'group';
}

export function nativeWhoCanSeeLabel(
  selection: NativeComposeSelection,
  viewerLabel = 'You',
): string {
  const names = [
    viewerLabel,
    ...selection.people.map((person) => person.name),
    ...selection.contacts.map((person) => person.name),
  ].filter((name) => name.trim().length > 0);

  if (selection.client) {
    const extras = names.filter((name) => name !== viewerLabel);
    const extra = extras.length > 0 ? ` plus ${extras.join(', ')}` : '';
    return `${viewerLabel} and every portal contact for ${selection.client.name}${extra}. New portal contacts join automatically.`;
  }

  if (selection.job) {
    const others = names.slice(1);
    if (others.length === 0) {
      return `${viewerLabel} on ${selection.job.title}. Only people you add can see this.`;
    }
    return `${names.join(', ')} on ${selection.job.title}. Only these people can see this.`;
  }

  if (names.length <= 1) {
    return 'Add a teammate, contact, client, or project.';
  }

  if (names.length === 2) {
    return `Only ${names[0]} and ${names[1]} can see this.`;
  }

  return `Only ${names.join(', ')} can see this.`;
}

export function nativeThreadTitle(input: {
  title?: string | null;
  type?: string | null;
  jobTitle?: string | null;
  currentUserId?: string | null;
  participants: Array<{
    user_id?: string | null;
    display_name?: string | null;
  }>;
}): string {
  const titled = input.title?.trim();
  if (titled) return titled;

  if ((input.type === 'job' || Boolean(input.jobTitle)) && input.jobTitle) {
    return input.jobTitle;
  }

  const others = input.participants
    .filter((participant) =>
      input.currentUserId ? participant.user_id !== input.currentUserId : true,
    )
    .map((participant) => participant.display_name?.trim())
    .filter((name): name is string => Boolean(name));

  const unique = Array.from(new Set(others));
  if (unique.length === 0) return 'Conversation';
  if (unique.length <= 3) return unique.join(', ');
  return `${unique.slice(0, 2).join(', ')} +${unique.length - 2}`;
}

export function matchesComposeQuery(
  query: string,
  ...fields: Array<string | null | undefined>
) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((field) => (field ?? '').toLowerCase().includes(needle));
}

export function isAllowedChatImageUrl(
  url: string,
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    '',
) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    if (!parsed.pathname.includes('/storage/v1/object/public/account_image/')) {
      return false;
    }
    if (!supabaseUrl) return true;
    return parsed.host === new URL(supabaseUrl).host;
  } catch {
    return false;
  }
}

export function nativeMessagePushUrl(
  threadId: string,
  workspace?: string | null,
) {
  const base = `so.ozer.app://message/${threadId}`;
  const slug = workspace?.trim();
  return slug ? `${base}?workspace=${encodeURIComponent(slug)}` : base;
}

export function buildNativeMessagePushPayload(input: {
  threadId: string;
  workspace?: string | null;
  title: string;
  body: string;
}) {
  return {
    title: input.title,
    body: input.body,
    threadId: input.threadId,
    url: nativeMessagePushUrl(input.threadId, input.workspace),
  };
}
