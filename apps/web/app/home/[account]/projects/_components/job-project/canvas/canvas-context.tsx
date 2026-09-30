'use client';

import { createContext, useContext } from 'react';

import type {
  CanvasItem,
  CanvasItemData,
} from '~/lib/projects/canvas/canvas-types';

import type {
  ProjectCanvasContact,
  ProjectCanvasDoc,
  ProjectCanvasNote,
} from '../../../_lib/schema/project-canvas.schema';
import type {
  JobBoardTask,
  PhaseListItem,
} from '../../../_lib/schema/project-phases.schema';

export type CanvasPerson = {
  id: string;
  name: string | null;
  email: string | null;
  pictureUrl: string | null;
  role?: string | null;
  description?: string | null;
};

export type CanvasClient = {
  id: string;
  displayName: string | null;
  companyName: string | null;
  email: string | null;
  pictureUrl: string | null;
};

export type CanvasLookups = {
  accountSlug: string;
  jobId: string;
  canEdit: boolean;
  /** A project guest is viewing: people and the client are locked, and there are no workspace links. */
  guest: boolean;
  phasesById: Map<string, PhaseListItem>;
  tasksById: Map<string, JobBoardTask>;
  subtaskCounts: Map<string, { total: number; done: number }>;
  /** Everyone who can be shown as an assignee (team members + contacts). */
  peopleById: Map<string, CanvasPerson>;
  /** Project team (assignees) — the people cards. */
  teamById: Map<string, CanvasPerson>;
  openTaskCountByPerson: Map<string, number>;
  client: CanvasClient | null;
  notesById: Map<string, ProjectCanvasNote>;
  contactsById: Map<string, ProjectCanvasContact>;
  docsById: Map<string, ProjectCanvasDoc>;
};

export type CanvasPersonRef = { kind: 'member' | 'contact'; id: string };

/**
 * Who a task is assigned to. A contact assignee wins: `user_id` stays set to
 * the internal owner when a task is handed to a contact.
 */
export function taskAssigneeId(
  task: Pick<JobBoardTask, 'user_id' | 'assignee_contact_id'>,
): string | null {
  return task.assignee_contact_id ?? task.user_id ?? null;
}

export type CanvasActions = {
  updateItemData: (id: string, patch: Partial<CanvasItemData>) => void;
  resizeItem: (
    id: string,
    box: { x: number; y: number; width: number; height: number },
  ) => void;
  openTask: (taskId: string) => void;
  editNote: (noteId: string) => void;
  editPerson: (person: CanvasPersonRef) => void;
  openDoc: (docId: string) => void;
  /** Save a link card to the project's links in Notes. */
  saveLink: (id: string) => void;
  linkBusy: ReadonlyMap<string, 'fetching' | 'saving'>;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
};

export type CanvasNodeData = { item: CanvasItem };

const CanvasLookupsContext = createContext<CanvasLookups | null>(null);
const CanvasActionsContext = createContext<CanvasActions | null>(null);

export const CanvasLookupsProvider = CanvasLookupsContext.Provider;
export const CanvasActionsProvider = CanvasActionsContext.Provider;

export function useCanvasLookups(): CanvasLookups {
  const value = useContext(CanvasLookupsContext);
  if (!value) throw new Error('Canvas lookups missing');
  return value;
}

export function useCanvasActions(): CanvasActions {
  const value = useContext(CanvasActionsContext);
  if (!value) throw new Error('Canvas actions missing');
  return value;
}
