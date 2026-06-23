'use client';

import { useEffect, useState, useTransition } from 'react';

import { Button } from '@kit/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import {
  resolveSpeakerLabel,
  type SpeakerBinding,
  type SpeakerMappings,
  type TranscriptSegment,
} from '~/lib/recorder/transcript-speakers';

import { saveSpeakerMappings } from './meeting-speaker-labels-editor';
import {
  SpeakerLabelPicker,
  type SpeakerPickerClient,
  type SpeakerPickerContact,
} from './speaker-label-picker';

type Props = {
  accountId: string;
  accountSlug: string;
  transcriptId: string;
  segments: TranscriptSegment[];
  mappings: SpeakerMappings;
  clients: SpeakerPickerClient[];
  contacts: SpeakerPickerContact[];
  linkClientId?: string | null;
  canEdit: boolean;
  onSaved: () => void;
  onMappingsChange: (mappings: SpeakerMappings) => void;
  onContactsChange: (contacts: SpeakerPickerContact[]) => void;
};

function SpeakerAssignPopover({
  accountId,
  speakerKey,
  mappings,
  binding,
  clients,
  contacts,
  linkClientId,
  disabled,
  onSave,
  onContactsChange,
}: {
  accountId: string;
  speakerKey: string;
  mappings: SpeakerMappings;
  binding: SpeakerBinding | null;
  clients: SpeakerPickerClient[];
  contacts: SpeakerPickerContact[];
  linkClientId?: string | null;
  disabled?: boolean;
  onSave: (binding: SpeakerBinding | null) => void;
  onContactsChange: (contacts: SpeakerPickerContact[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SpeakerBinding | null>(binding);

  useEffect(() => {
    if (open) {
      setDraft(binding);
    }
  }, [binding, open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'text-left text-xs font-semibold text-[var(--keel-teal)]',
            'rounded px-1 -mx-1 transition hover:bg-white/5 hover:underline',
          )}
        >
          {resolveSpeakerLabel(speakerKey, mappings, clients, contacts)}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 border-white/10 bg-[var(--workspace-shell-panel)] p-4"
        align="start"
      >
        <p className="mb-3 text-xs text-zinc-500">Assign: {speakerKey}</p>
        <SpeakerLabelPicker
          accountId={accountId}
          binding={draft}
          onBindingChange={setDraft}
          clients={clients}
          contacts={contacts}
          linkClientId={linkClientId}
          onContactCreated={(contact) => {
            onContactsChange(
              contacts.some((row) => row.id === contact.id)
                ? contacts
                : [...contacts, contact].sort((a, b) => a.name.localeCompare(b.name)),
            );
            setDraft({ type: 'contact', contactId: contact.id });
          }}
        />
        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            size="sm"
            className="flex-1 bg-[var(--keel-teal)] text-white hover:bg-[#238b7f]"
            onClick={() => {
              onSave(draft);
              setOpen(false);
            }}
          >
            Apply
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-white/10 text-zinc-300"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function MeetingTranscriptSegments({
  accountId,
  accountSlug,
  transcriptId,
  segments,
  mappings,
  clients,
  contacts,
  linkClientId,
  canEdit,
  onSaved,
  onMappingsChange,
  onContactsChange,
}: Props) {
  const [pending, startTransition] = useTransition();

  const persistMapping = (speakerKey: string, binding: SpeakerBinding | null) => {
    const next: SpeakerMappings = { ...mappings };
    if (!binding) {
      delete next[speakerKey];
    } else {
      next[speakerKey] = binding;
    }
    onMappingsChange(next);

    startTransition(async () => {
      try {
        await saveSpeakerMappings({
          accountId,
          accountSlug,
          transcriptId,
          mappings: next,
        });
        toast.success('Speaker updated');
        onSaved();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to update speaker');
      }
    });
  };

  return (
    <div className="space-y-4">
      {segments.map((segment, index) => {
        const speakerKey = segment.speaker;
        const displaySpeaker = resolveSpeakerLabel(
          speakerKey,
          mappings,
          clients,
          contacts,
        );

        return (
          <div key={`${speakerKey}-${index}`}>
            {canEdit ? (
              <SpeakerAssignPopover
                accountId={accountId}
                speakerKey={speakerKey}
                mappings={mappings}
                binding={mappings[speakerKey] ?? null}
                clients={clients}
                contacts={contacts}
                linkClientId={linkClientId}
                disabled={pending}
                onSave={(binding) => persistMapping(speakerKey, binding)}
                onContactsChange={onContactsChange}
              />
            ) : (
              <p className="text-xs font-semibold text-[var(--keel-teal)]">
                {displaySpeaker}
              </p>
            )}
            <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-200">
              {segment.text}
            </p>
          </div>
        );
      })}
    </div>
  );
}
