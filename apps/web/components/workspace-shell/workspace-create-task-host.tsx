'use client';

import { useCallback, useEffect, useState } from 'react';

import { usePathname, useRouter } from 'next/navigation';

import {
  AddTaskDialog,
  type CreateTaskWorkspaceChoice,
} from '~/home/(user)/_components/dashboard/add-task-dialog';

export const CREATE_TASK_EVENT = 'ozer:create-task';
const LEGACY_CREATE_TASK_EVENT = 'keel:create-task';

type WorkspaceCreateTaskHostProps = {
  /** Team workspace — omit (or set lifeOnly) for Personal. */
  accountId?: string;
  accountSlug?: string;
  /** Personal shell: life areas only. */
  lifeOnly?: boolean;
  /** Team shell: other workspaces the user can assign into. */
  workspaceChoices?: CreateTaskWorkspaceChoice[];
};

function readCreateTaskQuery(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return new URLSearchParams(window.location.search).get('create') === 'task';
}

export function WorkspaceCreateTaskHost({
  accountId,
  accountSlug,
  lifeOnly = false,
  workspaceChoices,
}: WorkspaceCreateTaskHostProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const clearCreateQuery = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('create') !== 'task') {
      return;
    }

    params.delete('create');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [pathname, router]);

  useEffect(() => {
    if (!readCreateTaskQuery()) {
      return;
    }

    setOpen(true);
    clearCreateQuery();
  }, [clearCreateQuery, pathname]);

  useEffect(() => {
    const onCreateTask = () => setOpen(true);
    window.addEventListener(CREATE_TASK_EVENT, onCreateTask);
    window.addEventListener(LEGACY_CREATE_TASK_EVENT, onCreateTask);
    return () => {
      window.removeEventListener(CREATE_TASK_EVENT, onCreateTask);
      window.removeEventListener(LEGACY_CREATE_TASK_EVENT, onCreateTask);
    };
  }, []);

  return (
    <AddTaskDialog
      workspaceAccountId={lifeOnly ? undefined : accountId}
      workspaceAccountSlug={lifeOnly ? undefined : accountSlug}
      lifeOnly={lifeOnly}
      workspaceChoices={lifeOnly ? undefined : workspaceChoices}
      open={open}
      onOpenChange={setOpen}
      hideTrigger
      allowInlineClientCreate={!lifeOnly}
    />
  );
}

export function openWorkspaceCreateTaskDialog() {
  window.dispatchEvent(new Event(CREATE_TASK_EVENT));
}
