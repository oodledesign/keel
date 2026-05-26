'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Layers, Plus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import { createCommunityMeetupSeries } from '../_lib/server/community-schedule.actions';
import type { MeetupSeriesOption } from '../_lib/community-schedule.types';

const panelClass =
  'rounded-2xl border border-white/6 bg-[var(--workspace-shell-panel)]';

type Props = {
  accountSlug: string;
  accountId: string;
  series: MeetupSeriesOption[];
};

export function CommunitySeriesPanel({
  accountSlug,
  accountId,
  series,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Series name is required');
      return;
    }
    startTransition(async () => {
      try {
        await createCommunityMeetupSeries({
          accountId,
          accountSlug,
          name: name.trim(),
          description: description.trim() || null,
        });
        toast.success('Series created');
        setOpen(false);
        setName('');
        setDescription('');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not create series');
      }
    });
  }

  return (
    <section className={panelClass}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/6 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-200/80">
            Meetup series
          </h3>
          <p className="mt-1 text-xs text-white/50">
            Named tracks for recurring home groups (e.g. &quot;Acts study&quot;, &quot;Summer
            term&quot;).
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-amber-400/30 text-amber-200"
          onClick={() => setOpen(true)}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          New series
        </Button>
      </div>

      {series.length === 0 ? (
        <p className="px-5 py-6 text-sm text-white/50">
          No series yet. Create one to tag meetups as part of a longer journey.
        </p>
      ) : (
        <ul className="divide-y divide-white/6">
          {series.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-3 px-5 py-3 text-sm text-white/80"
            >
              <Layers className="h-4 w-4 shrink-0 text-amber-400/80" />
              {s.name}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-white/10 bg-[var(--workspace-shell-panel)] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create a series</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acts study 2026"
                required
                className="border-white/10 bg-white/5"
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="border-white/10 bg-white/5"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="border-white/10"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} className={workspaceBtnPrimaryMd}>
                {isPending ? 'Creating…' : 'Create series'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
