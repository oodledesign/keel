'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import { Loader2, Users } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import {
  type SpeakerBinding,
  type SpeakerMappings,
  type TranscriptSegment,
  distinctTranscriptSpeakers,
} from '~/lib/recorder/transcript-speakers';

import { updateMeetingTranscriptSpeakerMappings } from '../../meeting-transcripts/_lib/server/server-actions';
import {
  SpeakerLabelPicker,
  type SpeakerPickerClient,
  type SpeakerPickerContact,
  type SpeakerPickerMember,
} from './speaker-label-picker';

type Props = {
  accountId: string;
  accountSlug: string;
  transcriptId: string;
  speakerSegments: TranscriptSegment[];
  initialMappings: SpeakerMappings;
  clients: SpeakerPickerClient[];
  contacts: SpeakerPickerContact[];
  members?: SpeakerPickerMember[];
  currentUserId?: string | null;
  linkClientId?: string | null;
  canEdit: boolean;
  onSaved: () => void;
  onMappingsChange?: (mappings: SpeakerMappings) => void;
  onContactsChange?: (contacts: SpeakerPickerContact[]) => void;
};

export function MeetingSpeakerLabelsEditor({
  accountId,
  accountSlug,
  transcriptId,
  speakerSegments,
  initialMappings,
  clients,
  contacts: initialContacts,
  members = [],
  currentUserId,
  linkClientId,
  canEdit,
  onSaved,
  onMappingsChange,
  onContactsChange,
}: Props) {
  const speakers = useMemo(
    () => distinctTranscriptSpeakers(speakerSegments),
    [speakerSegments],
  );

  const [mappings, setMappings] = useState<SpeakerMappings>(initialMappings);
  const [contacts, setContacts] = useState(initialContacts);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setMappings(initialMappings);
  }, [initialMappings]);

  useEffect(() => {
    setContacts(initialContacts);
  }, [initialContacts]);

  if (speakers.length === 0) {
    return null;
  }

  const updateMapping = (
    speakerKey: string,
    binding: SpeakerBinding | null,
  ) => {
    setMappings((current) => {
      const next = { ...current };
      if (!binding) {
        delete next[speakerKey];
      } else {
        next[speakerKey] = binding;
      }
      onMappingsChange?.(next);
      return next;
    });
  };

  const handleContactCreated = (contact: SpeakerPickerContact) => {
    setContacts((current) => {
      if (current.some((row) => row.id === contact.id)) return current;
      const next = [...current, contact].sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      onContactsChange?.(next);
      return next;
    });
  };

  const save = () => {
    if (!canEdit) return;

    startTransition(async () => {
      try {
        await updateMeetingTranscriptSpeakerMappings({
          accountId,
          accountSlug,
          transcriptId,
          mappings,
        });
        toast.success('Speaker labels saved');
        onSaved();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Failed to save speaker labels',
        );
      }
    });
  };

  return (
    <section className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Users className="h-4 w-4 text-[var(--ozer-accent)]" />
        <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Speaker labels
        </h2>
      </div>
      <p className="mb-4 text-sm text-[var(--workspace-shell-text-muted)]">
        Assign speakers to team members, clients, contacts, or a custom name.
        Linked records update automatically when their name changes.
      </p>

      <div className="space-y-4">
        {speakers.map((speakerKey) => (
          <div key={speakerKey} className="space-y-2">
            <Label className="text-xs text-[var(--workspace-shell-text-muted)]">
              Was: {speakerKey}
            </Label>
            <SpeakerLabelPicker
              accountId={accountId}
              binding={mappings[speakerKey] ?? null}
              onBindingChange={(binding) => updateMapping(speakerKey, binding)}
              clients={clients}
              contacts={contacts}
              members={members}
              currentUserId={currentUserId}
              linkClientId={linkClientId}
              onContactCreated={handleContactCreated}
              disabled={!canEdit || pending}
            />
          </div>
        ))}
      </div>

      {canEdit ? (
        <Button
          type="button"
          size="sm"
          disabled={pending}
          className="mt-5 w-full bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
          onClick={save}
        >
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save speaker labels
        </Button>
      ) : null}
    </section>
  );
}

export function saveSpeakerMappings({
  accountId,
  accountSlug,
  transcriptId,
  mappings,
}: {
  accountId: string;
  accountSlug: string;
  transcriptId: string;
  mappings: SpeakerMappings;
}) {
  return updateMeetingTranscriptSpeakerMappings({
    accountId,
    accountSlug,
    transcriptId,
    mappings,
  });
}
