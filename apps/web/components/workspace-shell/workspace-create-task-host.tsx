'use client';

import { useCallback, useEffect, useState } from 'react';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { AddTaskDialog } from '~/home/(user)/_components/dashboard/add-task-dialog';

export const CREATE_TASK_EVENT = 'keel:create-task';

type WorkspaceCreateTaskHostProps = {
  accountId: string;
  accountSlug: string;
};

export function WorkspaceCreateTaskHost({
  accountId,
  accountSlug,
}: WorkspaceCreateTaskHostProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const clearCreateQuery = useCallback(() => {
    if (searchParams.get('create') !== 'task') {
      return;
    }

    const next = new URLSearchParams(searchParams.toString());
    next.delete('create');
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (searchParams.get('create') === 'task') {
      setOpen(true);
      clearCreateQuery();
    }
  }, [clearCreateQuery, searchParams]);

  useEffect(() => {
    const onCreateTask = () => setOpen(true);
    window.addEventListener(CREATE_TASK_EVENT, onCreateTask);
    return () => window.removeEventListener(CREATE_TASK_EVENT, onCreateTask);
  }, []);

  return (
    <AddTaskDialog
      workspaceAccountId={accountId}
      workspaceAccountSlug={accountSlug}
      open={open}
      onOpenChange={setOpen}
      hideTrigger
      allowInlineClientCreate
    />
  );
}

export function openWorkspaceCreateTaskDialog() {
  window.dispatchEvent(new Event(CREATE_TASK_EVENT));
}
