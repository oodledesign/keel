'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import { Loader2, Users } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import {
  distinctTranscriptSpeakers,
  type SpeakerBinding,
  type SpeakerMappings,
  type TranscriptSegment,
} from '~/lib/recorder/transcript-speakers';

import { updateMeetingTranscriptSpeakerMappings } from '../../meeting-transcripts/_lib/server/server-actions';
import {
  SpeakerLabelPicker,
  type SpeakerPickerClient,
  type SpeakerPickerContact,
} from './speaker-label-picker';

type Props = {
  accountId: string;
  accountSlug: string;
  transcriptId: string;
  speakerSegments: TranscriptSegment[];
  initialMappings: SpeakerMappings;
  clients: SpeakerPickerClient[];
  contacts: SpeakerPickerContact[];
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

  const updateMapping = (speakerKey: string, binding: SpeakerBinding | null) => {
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
      const next = [...current, contact].sort((a, b) => a.name.localeCompare(b.name));
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
          error instanceof Error ? error.message : 'Failed to save speaker labels',
        );
      }
    });
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-[var(--workspace-shell-panel)] p-5 shadow-[0_18px_50px_rgba(4,10,24,0.24)]">
      <div className="mb-4 flex items-center gap-2">
        <Users className="h-4 w-4 text-[var(--keel-teal)]" />
        <h2 className="text-sm font-semibold text-white">Speaker labels</h2>
      </div>
      <p className="mb-4 text-sm text-zinc-400">
        Assign speakers to clients, contacts, or a custom name. Linked records update
        automatically when their name changes.
      </p>

      <div className="space-y-4">
        {speakers.map((speakerKey) => (
          <div key={speakerKey} className="space-y-2">
            <Label className="text-xs text-zinc-500">Was: {speakerKey}</Label>
            <SpeakerLabelPicker
              accountId={accountId}
              binding={mappings[speakerKey] ?? null}
              onBindingChange={(binding) => updateMapping(speakerKey, binding)}
              clients={clients}
              contacts={contacts}
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
          className="mt-5 w-full bg-[var(--keel-teal)] text-white hover:bg-[#238b7f]"
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
