'use client';

import { useEffect, useState, useTransition } from 'react';

import { Button } from '@kit/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import {
  type SpeakerBinding,
  type SpeakerMappings,
  type TranscriptSegment,
  resolveSpeakerLabel,
} from '~/lib/recorder/transcript-speakers';

import { saveSpeakerMappings } from './meeting-speaker-labels-editor';
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
  segments: TranscriptSegment[];
  mappings: SpeakerMappings;
  clients: SpeakerPickerClient[];
  contacts: SpeakerPickerContact[];
  members?: SpeakerPickerMember[];
  currentUserId?: string | null;
  linkClientId?: string | null;
  canEdit: boolean;
  editing?: boolean;
  draftSegments?: TranscriptSegment[];
  onDraftChange?: (segments: TranscriptSegment[]) => void;
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
  members,
  currentUserId,
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
  members: SpeakerPickerMember[];
  currentUserId?: string | null;
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
            'text-left text-xs font-semibold text-[var(--ozer-accent)]',
            '-mx-1 rounded px-1 transition hover:bg-[var(--workspace-shell-sidebar-accent)] hover:underline',
          )}
        >
          {resolveSpeakerLabel(
            speakerKey,
            mappings,
            clients,
            contacts,
            members.map((member) => ({
              userId: member.userId,
              name: member.name,
            })),
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4"
        align="start"
      >
        <p className="mb-3 text-xs text-[var(--workspace-shell-text-muted)]">
          Assign: {speakerKey}
        </p>
        <SpeakerLabelPicker
          accountId={accountId}
          binding={draft}
          onBindingChange={setDraft}
          clients={clients}
          contacts={contacts}
          members={members}
          currentUserId={currentUserId}
          linkClientId={linkClientId}
          onContactCreated={(contact) => {
            onContactsChange(
              contacts.some((row) => row.id === contact.id)
                ? contacts
                : [...contacts, contact].sort((a, b) =>
                    a.name.localeCompare(b.name),
                  ),
            );
            setDraft({ type: 'contact', contactId: contact.id });
          }}
        />
        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            size="sm"
            className="flex-1 bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
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
            className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]"
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
  members = [],
  currentUserId,
  linkClientId,
  canEdit,
  editing = false,
  draftSegments,
  onDraftChange,
  onSaved,
  onMappingsChange,
  onContactsChange,
}: Props) {
  const [pending, startTransition] = useTransition();
  const memberLookup = members.map((member) => ({
    userId: member.userId,
    name: member.name,
  }));
  const visibleSegments = draftSegments ?? segments;

  const persistMapping = (
    speakerKey: string,
    binding: SpeakerBinding | null,
  ) => {
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
        toast.error(
          error instanceof Error ? error.message : 'Failed to update speaker',
        );
      }
    });
  };

  return (
    <div className="space-y-4">
      {visibleSegments.map((segment, index) => {
        const speakerKey = segment.speaker;
        const displaySpeaker = resolveSpeakerLabel(
          speakerKey,
          mappings,
          clients,
          contacts,
          memberLookup,
        );

        return (
          <div key={`${speakerKey}-${index}`}>
            {canEdit && !editing ? (
              <SpeakerAssignPopover
                accountId={accountId}
                speakerKey={speakerKey}
                mappings={mappings}
                binding={mappings[speakerKey] ?? null}
                clients={clients}
                contacts={contacts}
                members={members}
                currentUserId={currentUserId}
                linkClientId={linkClientId}
                disabled={pending}
                onSave={(binding) => persistMapping(speakerKey, binding)}
                onContactsChange={onContactsChange}
              />
            ) : (
              <p className="text-xs font-semibold text-[var(--ozer-accent)]">
                {displaySpeaker}
              </p>
            )}
            {editing && onDraftChange ? (
              <Textarea
                value={segment.text}
                onChange={(event) => {
                  const next = visibleSegments.map((row, rowIndex) =>
                    rowIndex === index
                      ? { ...row, text: event.target.value }
                      : row,
                  );
                  onDraftChange(next);
                }}
                className="mt-1 min-h-[72px] border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-sm text-[var(--workspace-shell-text)]"
              />
            ) : (
              <p className="mt-1 text-sm whitespace-pre-wrap text-[var(--workspace-shell-text)]">
                {segment.text}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
