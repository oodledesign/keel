'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@kit/ui/avatar';
import { cn } from '@kit/ui/utils';

import {
  participantInitials,
  type MeetingParticipant,
} from '~/lib/recorder/meeting-participants';
import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

function normalizePhotoUrl(url: string | null | undefined) {
  return toSupabasePublicStorageUrl(url) ?? url?.trim() ?? null;
}

export function MeetingParticipantAvatars({
  participants,
  maxVisible = 5,
  className,
}: {
  participants: MeetingParticipant[];
  maxVisible?: number;
  className?: string;
}) {
  if (participants.length === 0) return null;

  const visible = participants.slice(0, maxVisible);
  const overflow = participants.length - visible.length;

  return (
    <div
      className={cn('flex shrink-0 items-center', className)}
      title={participants.map((row) => row.name).join(', ')}
    >
      <div className="flex -space-x-2">
        {visible.map((participant) => {
          const photoUrl = normalizePhotoUrl(participant.pictureUrl);
          return (
            <Avatar
              key={participant.key}
              className="h-7 w-7 border-2 border-[var(--workspace-shell-panel)] bg-zinc-800"
            >
              {photoUrl ? <AvatarImage src={photoUrl} alt="" /> : null}
              <AvatarFallback className="bg-zinc-700 text-[10px] font-medium text-zinc-200">
                {participantInitials(participant.name)}
              </AvatarFallback>
            </Avatar>
          );
        })}
      </div>
      {overflow > 0 ? (
        <span className="ml-1.5 text-[11px] font-medium text-zinc-500">
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
