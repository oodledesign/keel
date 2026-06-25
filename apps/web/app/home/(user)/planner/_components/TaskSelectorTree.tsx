'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Flag,
  ListTodo,
  Loader2,
  Pencil,
  Plus,
} from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@kit/ui/collapsible';
import { cn } from '@kit/ui/utils';

import { updateTask } from '~/home/(user)/_lib/actions/task-actions';
import { AddTaskDialog } from '~/home/(user)/_components/dashboard/add-task-dialog';
import { EditTaskDialog } from '~/home/(user)/tasks/_components/edit-task-dialog';
import { plannerTaskToPageTask } from '~/lib/planner/planner-task-to-page-task';
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
    <div className="space-y-3 border-t border-white/8 pt-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <ListTodo className="h-4 w-4 text-[#5eead4]" />
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
        <div className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center">
          <p className="text-sm text-white/55">No open tasks found.</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3 border-white/15 bg-white/5 text-white hover:bg-white/10"
            onClick={() => setAddTaskOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add a task to plan
          </Button>
        </div>
      ) : (
        <div className="max-h-[min(60vh,640px)] divide-y divide-white/8 overflow-y-auto pr-1">
          {taskTree.map((workspace) => (
            <WorkspaceNode
              key={workspace.id}
              workspace={workspace}
              selectedTaskIds={selectedTaskIds}
              toggle={toggle}
              scope={scope}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkspaceNode({
  workspace,
  selectedTaskIds,
  toggle,
  scope,
}: {
  workspace: PlannerWorkspaceNode;
  selectedTaskIds: Set<string>;
  toggle: (ids: string[], checked: boolean) => void;
  scope: PlannerScope;
}) {
  const [open, setOpen] = useState(true);
  const ids = workspace.projects.flatMap((project) =>
    project.tasks.map((task) => task.id),
  );
  const checked = ids.every((id) => selectedTaskIds.has(id));

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="py-2">
      <div className="flex items-center gap-2">
        <Checkbox
          checked={checked}
          onCheckedChange={(value) => toggle(ids, Boolean(value))}
          className="border-white/30"
        />
        <CollapsibleTrigger className="flex flex-1 items-center gap-2 text-left text-sm font-medium text-white">
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-white/45" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-white/45" />
          )}
          <span className="truncate">{workspace.name}</span>
          <span className="ml-auto text-xs font-normal text-white/40">
            {workspace.taskCount}
          </span>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="space-y-3 pb-2 pl-6 pt-2">
        {workspace.projects.map((project) => (
          <ProjectNode
            key={project.id}
            project={project}
            selectedTaskIds={selectedTaskIds}
            toggle={toggle}
            scope={scope}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ProjectNode({
  project,
  selectedTaskIds,
  toggle,
  scope,
}: {
  project: PlannerProjectNode;
  selectedTaskIds: Set<string>;
  toggle: (ids: string[], checked: boolean) => void;
  scope: PlannerScope;
}) {
  const [open, setOpen] = useState(true);
  const ids = project.tasks.map((task) => task.id);
  const checked = ids.every((id) => selectedTaskIds.has(id));
  const isGeneral = project.name.toLowerCase() === 'general';

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      {!isGeneral ? (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={checked}
            onCheckedChange={(value) => toggle(ids, Boolean(value))}
            className="border-white/30"
          />
          <CollapsibleTrigger className="flex flex-1 items-center gap-2 text-left text-[11px] font-semibold uppercase tracking-wide text-white/45">
            {open ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            <span className="truncate normal-case tracking-normal text-white/70">
              {project.name}
            </span>
            <span className="ml-auto text-white/35">{project.taskCount}</span>
          </CollapsibleTrigger>
        </div>
      ) : null}
      <CollapsibleContent className={cn('space-y-0.5', !isGeneral && 'mt-1 pl-6')}>
        {project.tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            checked={selectedTaskIds.has(task.id)}
            onCheckedChange={(nextChecked) => toggle([task.id], nextChecked)}
            scope={scope}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function TaskRow({
  task,
  checked,
  onCheckedChange,
  scope,
}: {
  task: PlannerTask;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  scope: PlannerScope;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [isCompleting, startCompleteTransition] = useTransition();
  const clientName = task.clientName?.trim();

  const handleMarkDone = () => {
    startCompleteTransition(async () => {
      const result = await updateTask(task.id, { status: 'completed' });
      if (result.success) {
        router.refresh();
      }
    });
  };

  return (
    <>
      <div
        className={cn(
          'group flex items-start gap-2 rounded-md px-1 py-1.5 text-sm transition-colors hover:bg-white/[0.04]',
          task.overdue && 'bg-amber-400/5',
        )}
      >
        <Checkbox
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(Boolean(value))}
          className="mt-0.5 border-white/30"
          aria-label={`Include ${task.title} in plan`}
        />
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => setEditOpen(true)}
        >
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="leading-snug text-white/90">{task.title}</span>
            {clientName ? (
              <span className="text-xs text-zinc-500">{clientName}</span>
            ) : null}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
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
        </button>
        <div className="flex shrink-0 items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-white/45 hover:bg-white/10 hover:text-emerald-300"
            aria-label={`Mark ${task.title} as done`}
            disabled={isCompleting}
            onClick={handleMarkDone}
          >
            {isCompleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-white/45 hover:bg-white/10 hover:text-white"
            aria-label={`Edit ${task.title}`}
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <EditTaskDialog
        task={plannerTaskToPageTask(task)}
        open={editOpen}
        onOpenChange={setEditOpen}
        workspaceAccountId={
          scope.kind === 'workspace' ? scope.accountId : undefined
        }
        onSaved={() => router.refresh()}
        onDeleted={() => router.refresh()}
      />
    </>
  );
}
