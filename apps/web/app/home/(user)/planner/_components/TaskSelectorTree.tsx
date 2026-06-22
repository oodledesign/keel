'use client';

import { useState } from 'react';

import Link from 'next/link';

import { ChevronDown, ChevronRight, Flag, FolderKanban, Plus } from 'lucide-react';

import { Avatar, AvatarFallback } from '@kit/ui/avatar';
import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@kit/ui/collapsible';
import { cn } from '@kit/ui/utils';

import { AddTaskDialog } from '~/home/(user)/_components/dashboard/add-task-dialog';
import type {
  PlannerProjectNode,
  PlannerScope,
  PlannerTask,
  PlannerWorkspaceNode,
} from '~/lib/planner/types';

type Props = {
  taskTree: PlannerWorkspaceNode[];
  selectedTaskIds: Set<string>;
  onSelectedTaskIdsChange: (ids: Set<string>) => void;
  includeWorkspaceTasks: boolean;
  settingsHref: string;
  scope: PlannerScope;
};

const priorityClass: Record<PlannerTask['priority'], string> = {
  urgent: 'border-rose-400/40 bg-rose-400/10 text-rose-200',
  high: 'border-orange-400/40 bg-orange-400/10 text-orange-200',
  medium: 'border-sky-400/40 bg-sky-400/10 text-sky-200',
  low: 'border-white/15 bg-white/5 text-white/55',
};

export function TaskSelectorTree({
  taskTree,
  selectedTaskIds,
  onSelectedTaskIdsChange,
  includeWorkspaceTasks,
  settingsHref,
  scope,
}: Props) {
  const [addTaskOpen, setAddTaskOpen] = useState(false);

  function toggle(ids: string[], checked: boolean) {
    const next = new Set(selectedTaskIds);
    for (const id of ids) {
      if (checked) next.add(id);
      else next.delete(id);
    }
    onSelectedTaskIdsChange(next);
  }

  const allCount = taskTree.reduce((sum, ws) => sum + ws.taskCount, 0);
  const selectedCount = selectedTaskIds.size;

  return (
    <section className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <FolderKanban className="h-4 w-4 text-[#5eead4]" />
            Tasks to plan
          </h2>
          <p className="mt-1 text-xs text-white/45">
            {selectedCount} of {allCount} open tasks selected.
            {!includeWorkspaceTasks ? (
              <>
                {' '}
                <Link href={settingsHref} className="text-[#5eead4] hover:underline">
                  Workspace tasks off
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 border-white/15 bg-white/5 text-xs text-white hover:bg-white/10"
            onClick={() => setAddTaskOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add task
          </Button>
          {allCount > 0 ? (
            <button
              type="button"
              className="text-xs font-medium text-[#5eead4] hover:underline"
              onClick={() => {
                const allIds = taskTree.flatMap((workspace) =>
                  workspace.projects.flatMap((project) =>
                    project.tasks.map((task) => task.id),
                  ),
                );
                toggle(allIds, selectedCount !== allIds.length);
              }}
            >
              {selectedCount === allCount ? 'Clear all' : 'Select all'}
            </button>
          ) : null}
        </div>
      </div>

      {scope.kind === 'workspace' ? (
        <AddTaskDialog
          workspaceAccountId={scope.accountId}
          workspaceAccountSlug={scope.accountSlug}
          open={addTaskOpen}
          onOpenChange={setAddTaskOpen}
          hideTrigger
          allowInlineClientCreate
        />
      ) : (
        <AddTaskDialog
          open={addTaskOpen}
          onOpenChange={setAddTaskOpen}
          hideTrigger
        />
      )}

      {taskTree.length === 0 ? (
        <div className="space-y-3 rounded-lg border border-white/8 bg-white/5 p-3">
          <p className="text-sm text-white/55">No open tasks found.</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-white/15 bg-white/5 text-white hover:bg-white/10"
            onClick={() => setAddTaskOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add a task to plan
          </Button>
        </div>
      ) : (
        <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
          {taskTree.map((workspace) => (
            <WorkspaceNode
              key={workspace.id}
              workspace={workspace}
              selectedTaskIds={selectedTaskIds}
              toggle={toggle}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function WorkspaceNode({
  workspace,
  selectedTaskIds,
  toggle,
}: {
  workspace: PlannerWorkspaceNode;
  selectedTaskIds: Set<string>;
  toggle: (ids: string[], checked: boolean) => void;
}) {
  const [open, setOpen] = useState(true);
  const ids = workspace.projects.flatMap((project) =>
    project.tasks.map((task) => task.id),
  );
  const checked = ids.every((id) => selectedTaskIds.has(id));

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-white/8 bg-white/5">
        <div className="flex items-center gap-2 px-3 py-2">
          <Checkbox
            checked={checked}
            onCheckedChange={(value) => toggle(ids, Boolean(value))}
            className="border-white/30"
          />
          <CollapsibleTrigger className="flex flex-1 items-center gap-2 text-left text-sm font-medium text-white">
            {open ? (
              <ChevronDown className="h-4 w-4 text-white/45" />
            ) : (
              <ChevronRight className="h-4 w-4 text-white/45" />
            )}
            <span className="truncate">{workspace.name}</span>
            <span className="ml-auto text-xs text-white/40">
              {workspace.taskCount}
            </span>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="space-y-2 border-t border-white/8 p-2">
          {workspace.projects.map((project) => (
            <ProjectNode
              key={project.id}
              project={project}
              selectedTaskIds={selectedTaskIds}
              toggle={toggle}
            />
          ))}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function ProjectNode({
  project,
  selectedTaskIds,
  toggle,
}: {
  project: PlannerProjectNode;
  selectedTaskIds: Set<string>;
  toggle: (ids: string[], checked: boolean) => void;
}) {
  const [open, setOpen] = useState(true);
  const ids = project.tasks.map((task) => task.id);
  const checked = ids.every((id) => selectedTaskIds.has(id));

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-white/6 bg-black/10">
        <div className="flex items-center gap-2 px-3 py-2">
          <Checkbox
            checked={checked}
            onCheckedChange={(value) => toggle(ids, Boolean(value))}
            className="border-white/30"
          />
          <CollapsibleTrigger className="flex flex-1 items-center gap-2 text-left text-xs font-medium uppercase tracking-wide text-white/60">
            {open ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            <span className="truncate">{project.name}</span>
            <span className="ml-auto">{project.taskCount}</span>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="space-y-1 p-2 pt-0">
          {project.tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              checked={selectedTaskIds.has(task.id)}
              onCheckedChange={(checked) => toggle([task.id], checked)}
            />
          ))}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function TaskRow({
  task,
  checked,
  onCheckedChange,
}: {
  task: PlannerTask;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-2 rounded-lg border border-transparent px-2 py-2 text-sm transition-colors hover:bg-white/5',
        task.overdue && 'border-amber-400/20 bg-amber-400/10',
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(Boolean(value))}
        className="mt-0.5 border-white/30"
      />
      <span className="min-w-0 flex-1">
        <span className="block leading-snug text-white/85">{task.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-2">
          <TaskClientLabel task={task} />
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className={cn('h-5 gap-1 px-1.5 text-[10px]', priorityClass[task.priority])}
            >
              <Flag className="h-3 w-3" />
              {task.priority}
            </Badge>
            {task.dueDateLabel ? (
              <span
                className={cn(
                  'text-[11px] text-white/40',
                  task.overdue && 'text-amber-200',
                )}
              >
                {task.overdue ? 'Overdue · ' : ''}
                {task.dueDateLabel}
              </span>
            ) : null}
          </span>
        </span>
      </span>
    </label>
  );
}

function TaskClientLabel({ task }: { task: PlannerTask }) {
  const name = task.clientName?.trim();
  if (!name) {
    return null;
  }

  const color = task.accentColor ?? task.workspaceColor ?? '#64748B';
  const initial = (name[0] ?? '?').toUpperCase();

  return (
    <span className="flex min-w-0 items-center gap-1.5" title={name}>
      <Avatar className="h-5 w-5 shrink-0">
        <AvatarFallback
          className="text-[9px] font-semibold text-white"
          style={{ backgroundColor: color }}
        >
          {initial}
        </AvatarFallback>
      </Avatar>
      <span className="truncate text-[11px] text-zinc-400">{name}</span>
    </span>
  );
}
