'use client';

import { createContext, useContext } from 'react';

import type {
  CanvasItem,
  CanvasItemData,
} from '~/lib/projects/canvas/canvas-types';

import type { ProjectCanvasNote } from '../../../_lib/schema/project-canvas.schema';
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
};

export type CanvasActions = {
  updateItemData: (id: string, patch: Partial<CanvasItemData>) => void;
  resizeItem: (
    id: string,
    box: { x: number; y: number; width: number; height: number },
  ) => void;
  openTask: (taskId: string) => void;
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
