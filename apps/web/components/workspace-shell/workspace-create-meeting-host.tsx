'use client';

import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import { CreateMeetingDialog } from '~/home/[account]/scheduling/_components/create-meeting-dialog';

export const CREATE_MEETING_EVENT = 'ozer:create-meeting';

type WorkspaceCreateMeetingHostProps = {
  accountId: string;
  accountSlug: string;
};

export function WorkspaceCreateMeetingHost({
  accountId,
  accountSlug,
}: WorkspaceCreateMeetingHostProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onCreateMeeting = () => setOpen(true);
    window.addEventListener(CREATE_MEETING_EVENT, onCreateMeeting);
    return () => {
      window.removeEventListener(CREATE_MEETING_EVENT, onCreateMeeting);
    };
  }, []);

  return (
    <CreateMeetingDialog
      open={open}
      onOpenChange={setOpen}
      accountId={accountId}
      accountSlug={accountSlug}
      onCreated={() => router.refresh()}
    />
  );
}

export function openWorkspaceCreateMeetingDialog() {
  window.dispatchEvent(new Event(CREATE_MEETING_EVENT));
}
