import type { SpeakerMappings } from '~/lib/recorder/transcript-speakers';
import { resolveSpeakerLabel } from '~/lib/recorder/transcript-speakers';

export type MeetingParticipantLookupClient = {
  id: string;
  name: string;
  pictureUrl?: string | null;
};

export type MeetingParticipantLookupContact = {
  id: string;
  name: string;
  pictureUrl?: string | null;
};

export type MeetingParticipant = {
  key: string;
  name: string;
  pictureUrl: string | null;
  type: 'client' | 'contact' | 'custom' | 'member';
};

function participantKey(binding: SpeakerMappings[string]): string {
  if (binding.type === 'client') return `client:${binding.clientId}`;
  if (binding.type === 'contact') return `contact:${binding.contactId}`;
  if (binding.type === 'member') return `member:${binding.userId}`;
  return `custom:${binding.name.trim().toLowerCase()}`;
}

export function resolveMeetingParticipants(
  mappings: SpeakerMappings,
  clients: MeetingParticipantLookupClient[],
  contacts: MeetingParticipantLookupContact[],
  members: Array<{
    userId: string;
    name: string;
    pictureUrl?: string | null;
  }> = [],
): MeetingParticipant[] {
  const byKey = new Map<string, MeetingParticipant>();

  for (const binding of Object.values(mappings)) {
    const key = participantKey(binding);
    if (byKey.has(key)) continue;

    if (binding.type === 'client') {
      const client = clients.find((row) => row.id === binding.clientId);
      byKey.set(key, {
        key,
        name: client?.name ?? 'Client',
        pictureUrl: client?.pictureUrl ?? null,
        type: 'client',
      });
      continue;
    }

    if (binding.type === 'contact') {
      const contact = contacts.find((row) => row.id === binding.contactId);
      byKey.set(key, {
        key,
        name: contact?.name ?? 'Contact',
        pictureUrl: contact?.pictureUrl ?? null,
        type: 'contact',
      });
      continue;
    }

    if (binding.type === 'member') {
      const member = members.find((row) => row.userId === binding.userId);
      byKey.set(key, {
        key,
        name: member?.name ?? 'Team member',
        pictureUrl: member?.pictureUrl ?? null,
        type: 'member',
      });
      continue;
    }

    byKey.set(key, {
      key,
      name: binding.name.trim(),
      pictureUrl: null,
      type: 'custom',
    });
  }

  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function participantInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
}

export function resolvedSpeakerNames(
  speakerKeys: string[],
  mappings: SpeakerMappings,
  clients: MeetingParticipantLookupClient[],
  contacts: MeetingParticipantLookupContact[],
  members: Array<{ userId: string; name: string }> = [],
) {
  return speakerKeys.map((key) =>
    resolveSpeakerLabel(
      key,
      mappings,
      clients.map((row) => ({ id: row.id, name: row.name })),
      contacts.map((row) => ({ id: row.id, name: row.name })),
      members,
    ),
  );
}
