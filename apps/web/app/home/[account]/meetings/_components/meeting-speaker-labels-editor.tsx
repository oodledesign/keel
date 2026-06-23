'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import { Loader2, Users } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import {
  distinctTranscriptSpeakers,
  type TranscriptSegment,
} from '~/lib/recorder/transcript-speakers';

import { updateMeetingTranscriptSpeakerLabels } from '../../meeting-transcripts/_lib/server/server-actions';

type Props = {
  accountId: string;
  accountSlug: string;
  transcriptId: string;
  speakerSegments: TranscriptSegment[];
  suggestions: string[];
  canEdit: boolean;
  onSaved: () => void;
};

export function MeetingSpeakerLabelsEditor({
  accountId,
  accountSlug,
  transcriptId,
  speakerSegments,
  suggestions,
  canEdit,
  onSaved,
}: Props) {
  const speakers = useMemo(
    () => distinctTranscriptSpeakers(speakerSegments),
    [speakerSegments],
  );

  const [namesBySpeaker, setNamesBySpeaker] = useState<Record<string, string>>(
    () => Object.fromEntries(speakers.map((speaker) => [speaker, speaker])),
  );
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setNamesBySpeaker(
      Object.fromEntries(speakers.map((speaker) => [speaker, speaker])),
    );
  }, [speakers]);

  if (speakers.length === 0) {
    return null;
  }

  const hasChanges = speakers.some(
    (speaker) => (namesBySpeaker[speaker] ?? speaker).trim() !== speaker,
  );

  const applySuggestion = (speaker: string, suggestion: string) => {
    setNamesBySpeaker((current) => ({
      ...current,
      [speaker]: suggestion,
    }));
  };

  const save = () => {
    if (!canEdit || !hasChanges) return;

    const renames: Record<string, string> = {};
    for (const speaker of speakers) {
      const next = (namesBySpeaker[speaker] ?? speaker).trim();
      if (!next) {
        toast.error(`Speaker label cannot be empty (${speaker})`);
        return;
      }
      if (next !== speaker) {
        renames[speaker] = next;
      }
    }

    if (Object.keys(renames).length === 0) {
      return;
    }

    startTransition(async () => {
      try {
        await updateMeetingTranscriptSpeakerLabels({
          accountId,
          accountSlug,
          transcriptId,
          renames,
        });
        toast.success('Speaker labels updated');
        onSaved();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to update speakers',
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
        Rename speakers after sync. Updates every line in the transcript.
      </p>

      <div className="space-y-4">
        {speakers.map((speaker) => {
          const value = namesBySpeaker[speaker] ?? speaker;
          const rowSuggestions = suggestions.filter(
            (suggestion) =>
              suggestion !== speaker && suggestion.toLowerCase() !== value.toLowerCase(),
          );

          return (
            <div key={speaker} className="space-y-2">
              <Label className="text-xs text-zinc-500">Was: {speaker}</Label>
              {canEdit ? (
                <Input
                  value={value}
                  onChange={(event) =>
                    setNamesBySpeaker((current) => ({
                      ...current,
                      [speaker]: event.target.value,
                    }))
                  }
                  list={`speaker-suggestions-${speaker}`}
                  className="border-white/10 bg-white/5 text-white"
                  placeholder="Display name"
                />
              ) : (
                <p className="text-sm text-white">{value}</p>
              )}
              {canEdit && rowSuggestions.length > 0 ? (
                <>
                  <datalist id={`speaker-suggestions-${speaker}`}>
                    {rowSuggestions.map((suggestion) => (
                      <option key={suggestion} value={suggestion} />
                    ))}
                  </datalist>
                  <div className="flex flex-wrap gap-2">
                    {rowSuggestions.slice(0, 4).map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => applySuggestion(speaker, suggestion)}
                        className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-300 hover:bg-white/10 hover:text-white"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          );
        })}
      </div>

      {canEdit ? (
        <Button
          type="button"
          size="sm"
          disabled={!hasChanges || pending}
          className="mt-5 w-full bg-[var(--keel-teal)] text-white hover:bg-[#238b7f]"
          onClick={save}
        >
          {pending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Save speaker labels
        </Button>
      ) : null}
    </section>
  );
}
