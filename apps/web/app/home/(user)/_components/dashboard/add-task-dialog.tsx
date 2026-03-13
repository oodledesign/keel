'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';

import { Loader2, Plus } from 'lucide-react';

import {
  createTask,
  loadTaskAssignmentOptions,
  type TaskAssignmentOption,
} from '../../_lib/actions/task-actions';

const PRIORITIES = [
  { key: 'low', label: 'Low' },
  { key: 'medium', label: 'Medium' },
  { key: 'high', label: 'High' },
  { key: 'urgent', label: 'Urgent' },
];

export function AddTaskDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<TaskAssignmentOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const [priority, setPriority] = useState('medium');
  const [assignTo, setAssignTo] = useState('none');

  useEffect(() => {
    if (open && options.length === 0) {
      setOptionsLoading(true);
      loadTaskAssignmentOptions()
        .then(setOptions)
        .finally(() => setOptionsLoading(false));
    }
  }, [open, options.length]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);

    const title = (form.get('title') as string).trim();
    const dueDate = (form.get('dueDate') as string).trim();

    if (!title) {
      setError('Task title is required');
      return;
    }

    const selected = options.find((o) => o.id === assignTo);

    startTransition(async () => {
      const result = await createTask({
        title,
        priority,
        dueDate: dueDate || undefined,
        projectId: selected?.type === 'project' ? selected.id : undefined,
        areaId: selected?.type === 'area' ? selected.id : undefined,
      });

      if (!result.success) {
        setError(result.error ?? 'Failed to create task');
        return;
      }

      setOpen(false);
      setPriority('medium');
      setAssignTo('none');
      formRef.current?.reset();
    });
  }

  const projects = options.filter((o) => o.type === 'project');
  const areas = options.filter((o) => o.type === 'area');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-[#57C87F] px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#4ab86f]"
        >
          <Plus className="h-4 w-4" />
          Add Task
        </button>
      </DialogTrigger>
      <DialogContent className="border-white/8 bg-[#0F1923] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a new task</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Create a task and assign it to a project or life area.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-zinc-300">
              Task title *
            </Label>
            <Input
              id="title"
              name="title"
              placeholder="What needs to be done?"
              required
              autoFocus
              className="border-white/10 bg-white/5 text-white placeholder:text-zinc-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="border-white/10 bg-white/5 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#1A2535] text-white">
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate" className="text-zinc-300">
                Due date
              </Label>
              <Input
                id="dueDate"
                name="dueDate"
                type="date"
                className="border-white/10 bg-white/5 text-white placeholder:text-zinc-600"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-300">Assign to</Label>
            {optionsLoading ? (
              <div className="flex h-9 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-zinc-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading...
              </div>
            ) : (
              <Select value={assignTo} onValueChange={setAssignTo}>
                <SelectTrigger className="border-white/10 bg-white/5 text-white">
                  <SelectValue placeholder="No assignment" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#1A2535] text-white">
                  <SelectItem value="none">No assignment</SelectItem>
                  {projects.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                        Projects
                      </div>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="flex items-center gap-2">
                            {p.color && (
                              <span
                                className="inline-block h-2 w-2 rounded-full"
                                style={{ backgroundColor: p.color }}
                              />
                            )}
                            {p.name}
                          </span>
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {areas.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                        Life areas
                      </div>
                      {areas.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          <span className="flex items-center gap-2">
                            {a.color && (
                              <span
                                className="inline-block h-2 w-2 rounded-full"
                                style={{ backgroundColor: a.color }}
                              />
                            )}
                            {a.name}
                          </span>
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {error && (
            <p className="text-sm text-rose-400">{error}</p>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-9 rounded-xl border border-white/10 px-4 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#57C87F] px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#4ab86f] disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Task'
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
