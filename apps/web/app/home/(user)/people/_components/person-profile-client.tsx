'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  ArrowLeft,
  Cake,
  Gift,
  MapPin,
  MessageSquare,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';

import {
  createCatchupAction,
  createGiftIdeaAction,
  createPersonDateAction,
  createPersonNoteAction,
  deleteCatchupAction,
  deleteGiftIdeaAction,
  deletePersonAction,
  deletePersonDateAction,
  deletePersonNoteAction,
  toggleGiftPurchasedAction,
} from '../_lib/actions/people-actions';
import { DATE_KINDS } from '../_lib/schema/people.schema';
import type { PersonProfile } from '../_lib/server/people.service';
import { CircleTierBadge } from './circle-tier-badge';
import { PersonFormDialog } from './person-form-dialog';
import { PersonImageUploader } from './person-image-uploader';

const panelClass =
  'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]';

type Props = {
  person: PersonProfile;
};

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateYmd(ymd: string) {
  const d = new Date(`${ymd}T12:00:00`);
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatMonthDay(month: number, day: number) {
  const d = new Date(2000, month - 1, day, 12, 0, 0, 0);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}

function displayName(p: PersonProfile) {
  return p.nickname?.trim() || p.full_name;
}

export function PersonProfileClient({ person }: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [catchupOpen, setCatchupOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [, startTransition] = useTransition();

  const name = displayName(person);

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deletePersonAction({ id: person.id });
      if (result.success) {
        router.push(pathsConfig.app.personalPeople);
      }
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 px-4 pt-2 pb-12 text-[var(--workspace-shell-text)] md:px-0">
      <div className="flex items-center gap-3">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]"
        >
          <Link href={pathsConfig.app.personalPeople}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            People
          </Link>
        </Button>
      </div>

      <div className={cn(panelClass, 'p-6')}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="shrink-0">
              <PersonImageUploader
                personId={person.id}
                personName={name}
                avatarUrl={person.avatar_url}
                onUpdated={() => router.refresh()}
              />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">{name}</h1>
              {person.nickname && person.full_name !== person.nickname && (
                <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                  {person.full_name}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--workspace-shell-text-muted)]">
                <CircleTierBadge tier={person.circle_tier} showFullLabel />
                {person.relationship_label && (
                  <span className="rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2.5 py-0.5">
                    {person.relationship_label}
                  </span>
                )}
                {person.email && <span>{person.email}</span>}
                {person.phone && <span>{person.phone}</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-[color:var(--workspace-shell-border)] bg-transparent text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-rose-500/30 bg-transparent text-rose-300 hover:bg-rose-500/10"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <SummaryTile
            label="Last met"
            value={
              person.last_catchup_on
                ? formatDateYmd(person.last_catchup_on)
                : 'Not yet'
            }
          />
          <SummaryTile
            label="Catch-up"
            value={
              person.catchup_cadence_days
                ? person.catchupOverdue
                  ? 'Overdue'
                  : person.nextCatchupDueOn
                    ? `Due ${formatDateYmd(person.nextCatchupDueOn)}`
                    : 'On track'
                : 'Off'
            }
            highlight={person.catchupOverdue}
          />
          <SummaryTile
            label="Birthday"
            value={
              person.daysUntilBirthday !== null
                ? person.daysUntilBirthday === 0
                  ? 'Today!'
                  : `In ${person.daysUntilBirthday} days`
                : '—'
            }
          />
        </div>

        {person.general_notes && (
          <p className="mt-4 rounded-xl bg-[var(--workspace-shell-sidebar-accent)] px-4 py-3 text-sm text-[var(--workspace-shell-text-muted)]">
            {person.general_notes}
          </p>
        )}
      </div>

      <Section
        title="Catchups"
        icon={MessageSquare}
        action={
          <Button
            size="sm"
            className="bg-[var(--ozer-accent)] hover:bg-[var(--ozer-accent-hover)]"
            onClick={() => setCatchupOpen(true)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Log catchup
          </Button>
        }
      >
        {person.catchups.length === 0 ? (
          <EmptySection message="Log when you meet up and what you talked about." />
        ) : (
          <div className="space-y-3">
            {person.catchups.map((c) => (
              <div key={c.id} className={cn(panelClass, 'p-4')}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-[var(--workspace-shell-text)]">
                      {formatDateYmd(c.met_on)}
                    </p>
                    {c.location && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-[var(--workspace-shell-text-muted)]">
                        <MapPin className="h-3 w-3" />
                        {c.location}
                      </p>
                    )}
                    {c.conversation_notes && (
                      <p className="mt-2 text-sm whitespace-pre-wrap text-[var(--workspace-shell-text-muted)]">
                        {c.conversation_notes}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-[var(--workspace-shell-text-muted)] hover:text-rose-400"
                    onClick={() =>
                      startTransition(async () => {
                        await deleteCatchupAction({
                          id: c.id,
                          personId: person.id,
                        });
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Notes"
        icon={StickyNote}
        action={
          <Button
            size="sm"
            variant="outline"
            className="border-[color:var(--workspace-shell-border)] bg-transparent text-[var(--workspace-shell-text-muted)]"
            onClick={() => setNoteOpen(true)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add note
          </Button>
        }
      >
        {person.notes.length === 0 ? (
          <EmptySection message="Evergreen facts — allergies, preferences, topics to ask about." />
        ) : (
          <div className="space-y-2">
            {person.notes.map((n) => (
              <div
                key={n.id}
                className={cn(
                  panelClass,
                  'flex items-start justify-between gap-3 p-4',
                )}
              >
                <div>
                  <p className="text-sm whitespace-pre-wrap text-[var(--workspace-shell-text)]">
                    {n.body}
                  </p>
                  <p className="mt-2 text-[11px] text-[var(--workspace-shell-text-muted)]">
                    {new Date(n.created_at).toLocaleDateString('en-GB')}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-[var(--workspace-shell-text-muted)] hover:text-rose-400"
                  onClick={() =>
                    startTransition(async () => {
                      await deletePersonNoteAction({
                        id: n.id,
                        personId: person.id,
                      });
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Important dates"
        icon={Cake}
        action={
          <Button
            size="sm"
            variant="outline"
            className="border-[color:var(--workspace-shell-border)] bg-transparent text-[var(--workspace-shell-text-muted)]"
            onClick={() => setDateOpen(true)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add date
          </Button>
        }
      >
        {person.dates.length === 0 ? (
          <EmptySection message="Birthdays, anniversaries, and other dates worth remembering." />
        ) : (
          <div className="space-y-2">
            {person.dates.map((d) => (
              <div
                key={d.id}
                className={cn(
                  panelClass,
                  'flex items-center justify-between p-4',
                )}
              >
                <div>
                  <p className="font-medium text-[var(--workspace-shell-text)] capitalize">
                    {d.kind === 'custom' ? d.label || 'Custom' : d.kind}
                  </p>
                  <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                    {formatMonthDay(d.month, d.day)}
                    {d.year_optional ? ` (${d.year_optional})` : ''}
                  </p>
                  {d.notes && (
                    <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
                      {d.notes}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-[var(--workspace-shell-text-muted)] hover:text-rose-400"
                  onClick={() =>
                    startTransition(async () => {
                      await deletePersonDateAction({
                        id: d.id,
                        personId: person.id,
                      });
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Gift ideas"
        icon={Gift}
        action={
          <Button
            size="sm"
            variant="outline"
            className="border-[color:var(--workspace-shell-border)] bg-transparent text-[var(--workspace-shell-text-muted)]"
            onClick={() => setGiftOpen(true)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add idea
          </Button>
        }
      >
        {person.giftIdeas.length === 0 ? (
          <EmptySection message="Save gift ideas so you're never stuck when it's time to celebrate." />
        ) : (
          <div className="space-y-2">
            {person.giftIdeas.map((g) => (
              <div
                key={g.id}
                className={cn(panelClass, 'flex items-start gap-3 p-4')}
              >
                <Checkbox
                  checked={g.purchased}
                  onCheckedChange={(checked) =>
                    startTransition(async () => {
                      await toggleGiftPurchasedAction({
                        id: g.id,
                        personId: person.id,
                        purchased: checked === true,
                      });
                    })
                  }
                  className="mt-0.5 border-[color:var(--workspace-shell-border)] data-[state=checked]:bg-[var(--ozer-accent)]"
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'font-medium text-[var(--workspace-shell-text)]',
                      g.purchased &&
                        'text-[var(--workspace-shell-text-muted)] line-through',
                    )}
                  >
                    {g.title}
                  </p>
                  {g.occasion && (
                    <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                      {g.occasion}
                    </p>
                  )}
                  {g.notes && (
                    <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
                      {g.notes}
                    </p>
                  )}
                  {g.url && (
                    <a
                      href={g.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs text-[var(--ozer-accent-muted)] hover:underline"
                    >
                      View link
                    </a>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-[var(--workspace-shell-text-muted)] hover:text-rose-400"
                  onClick={() =>
                    startTransition(async () => {
                      await deleteGiftIdeaAction({
                        id: g.id,
                        personId: person.id,
                      });
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <PersonFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        person={person}
        onPhotoUpdated={() => router.refresh()}
      />

      <LogCatchupDialog
        open={catchupOpen}
        onOpenChange={setCatchupOpen}
        personId={person.id}
      />
      <AddDateDialog
        open={dateOpen}
        onOpenChange={setDateOpen}
        personId={person.id}
      />
      <AddGiftDialog
        open={giftOpen}
        onOpenChange={setGiftOpen}
        personId={person.id}
      />
      <AddNoteDialog
        open={noteOpen}
        onOpenChange={setNoteOpen}
        personId={person.id}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)]">
          <DialogHeader>
            <DialogTitle>Delete {name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            This removes all notes, dates, gift ideas, and catchup history for
            this person. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl bg-[var(--workspace-shell-sidebar-accent)] px-4 py-3">
      <p className="text-[11px] tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
        {label}
      </p>
      <p
        className={cn(
          'mt-1 text-sm font-medium',
          highlight ? 'text-amber-300' : 'text-[var(--workspace-shell-text)]',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  action,
  children,
}: React.PropsWithChildren<{
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
}>) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--workspace-shell-text)]">
          <Icon className="h-4 w-4 text-[var(--ozer-accent-muted)]" />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptySection({ message }: { message: string }) {
  return (
    <div
      className={cn(
        panelClass,
        'px-4 py-8 text-center text-sm text-[var(--workspace-shell-text-muted)]',
      )}
    >
      {message}
    </div>
  );
}

function LogCatchupDialog({
  open,
  onOpenChange,
  personId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  personId: string;
}) {
  const [metOn, setMetOn] = useState(todayYmd());
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await createCatchupAction({
        personId,
        metOn,
        location: location || null,
        conversationNotes: notes || null,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
      setNotes('');
      setLocation('');
      setMetOn(todayYmd());
    });
  };

  return (
    <QuickDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Log catchup"
      pending={pending}
      onSubmit={submit}
      error={error}
    >
      <div className="grid gap-2">
        <Label>Date</Label>
        <Input
          type="date"
          className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
          value={metOn}
          onChange={(e) => setMetOn(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label>Location</Label>
        <Input
          className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Coffee shop, video call…"
        />
      </div>
      <div className="grid gap-2">
        <Label>What did you talk about?</Label>
        <Textarea
          className="min-h-[100px] border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </QuickDialog>
  );
}

function AddDateDialog({
  open,
  onOpenChange,
  personId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  personId: string;
}) {
  const [kind, setKind] = useState<(typeof DATE_KINDS)[number]>('birthday');
  const [month, setMonth] = useState('1');
  const [day, setDay] = useState('1');
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await createPersonDateAction({
        personId,
        kind,
        month: Number.parseInt(month, 10),
        day: Number.parseInt(day, 10),
        label: kind === 'custom' ? label : null,
        notes: notes || null,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
    });
  };

  return (
    <QuickDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add important date"
      pending={pending}
      onSubmit={submit}
      error={error}
    >
      <div className="grid gap-2">
        <Label>Type</Label>
        <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
          <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)]">
            {DATE_KINDS.map((k) => (
              <SelectItem key={k} value={k} className="capitalize">
                {k}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {kind === 'custom' && (
        <div className="grid gap-2">
          <Label>Label</Label>
          <Input
            className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label>Month</Label>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)]">
              {Array.from({ length: 12 }, (_, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>
                  {new Date(2000, i, 1).toLocaleString('en-GB', {
                    month: 'long',
                  })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Day</Label>
          <Select value={day} onValueChange={setDay}>
            <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)]">
              {Array.from({ length: 31 }, (_, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>
                  {i + 1}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-2">
        <Label>Notes</Label>
        <Input
          className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </QuickDialog>
  );
}

function AddGiftDialog({
  open,
  onOpenChange,
  personId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  personId: string;
}) {
  const [title, setTitle] = useState('');
  const [occasion, setOccasion] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await createGiftIdeaAction({
        personId,
        title,
        occasion: occasion || null,
        url: url || null,
        notes: notes || null,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
      setTitle('');
      setOccasion('');
      setUrl('');
      setNotes('');
    });
  };

  return (
    <QuickDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add gift idea"
      pending={pending}
      onSubmit={submit}
      error={error}
      disabled={!title.trim()}
    >
      <div className="grid gap-2">
        <Label>Title</Label>
        <Input
          className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label>Occasion</Label>
        <Input
          className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
          value={occasion}
          onChange={(e) => setOccasion(e.target.value)}
          placeholder="Birthday, Christmas…"
        />
      </div>
      <div className="grid gap-2">
        <Label>Link</Label>
        <Input
          className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://"
        />
      </div>
      <div className="grid gap-2">
        <Label>Notes</Label>
        <Textarea
          className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </QuickDialog>
  );
}

function AddNoteDialog({
  open,
  onOpenChange,
  personId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  personId: string;
}) {
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await createPersonNoteAction({ personId, body });
      if (!result.success) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
      setBody('');
    });
  };

  return (
    <QuickDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add note"
      pending={pending}
      onSubmit={submit}
      error={error}
      disabled={!body.trim()}
    >
      <Textarea
        className="min-h-[120px] border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Something worth remembering…"
      />
    </QuickDialog>
  );
}

function QuickDialog({
  open,
  onOpenChange,
  title,
  children,
  pending,
  onSubmit,
  error,
  disabled,
}: React.PropsWithChildren<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  pending: boolean;
  onSubmit: () => void;
  error: string | null;
  disabled?: boolean;
}>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">{children}</div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-[var(--ozer-accent)] hover:bg-[var(--ozer-accent-hover)]"
            disabled={pending || disabled}
            onClick={onSubmit}
          >
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
