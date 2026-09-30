'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';

import { Building2, LayoutGrid, Plus, UserPlus, X } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { ProfileAvatar } from '@kit/ui/profile-avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import { getErrorMessage } from '../../../_lib/error-message';
import type { ProjectCanvasContact } from '../../../_lib/schema/project-canvas.schema';
import type { ProjectContactCandidate } from '../../../_lib/schema/project-team.schema';
import {
  addProjectContact,
  addProjectMember,
  createProjectContact,
  removeProjectContact,
  removeProjectMember,
  searchProjectContacts,
  updateProjectContact,
  updateProjectMember,
} from '../../../_lib/server/project-team.actions';
import type {
  CanvasClient,
  CanvasPerson,
  CanvasPersonRef,
} from './canvas-context';

const ROLE_SUGGESTIONS = [
  'Project lead',
  'Account manager',
  'Decision maker',
  'Day-to-day contact',
  'Finance',
  'Legal',
  'Marketing lead',
  'Designer',
  'Developer',
  'Surveyor',
  'Consultant',
  'Supplier',
];
const ROLE_LIST_ID = 'canvas-team-roles';
const SEARCH_DEBOUNCE_MS = 250;

type PersonDetails = { role: string | null; description: string | null };

export function CanvasTeamDialog({
  open,
  onOpenChange,
  accountId,
  accountSlug,
  jobId,
  canEdit,
  focus,
  team,
  workspaceMembers,
  client,
  contacts,
  onChanged,
  onLayoutSection,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountSlug: string;
  jobId: string;
  canEdit: boolean;
  focus: CanvasPersonRef | null;
  team: CanvasPerson[];
  workspaceMembers: CanvasPerson[];
  client: CanvasClient | null;
  contacts: ProjectCanvasContact[];
  onChanged: () => void;
  onLayoutSection: () => void;
}) {
  const project = { accountId, accountSlug, jobId };

  const run = async (work: () => Promise<unknown>, success?: string) => {
    try {
      await work();
      if (success) toast.success(success);
      onChanged();
      return true;
    } catch (error) {
      toast.error(getErrorMessage(error));
      return false;
    }
  };

  const available = workspaceMembers.filter(
    (member) => !team.some((person) => person.id === member.id),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Project team</DialogTitle>
          <DialogDescription>
            Who&apos;s involved and what they do. Roles and descriptions show on
            the canvas cards.
          </DialogDescription>
        </DialogHeader>
        <datalist id={ROLE_LIST_ID}>
          {ROLE_SUGGESTIONS.map((role) => (
            <option key={role} value={role} />
          ))}
        </datalist>

        <div className="-mx-6 min-h-0 flex-1 space-y-6 overflow-y-auto px-6">
          <section className="space-y-2">
            <SectionHeading title="Your team" count={team.length} />
            {team.length === 0 ? (
              <EmptyHint>No one is assigned to this project yet.</EmptyHint>
            ) : (
              team.map((person) => (
                <PersonRow
                  key={person.id}
                  name={person.name || person.email || 'Team member'}
                  subtitle={person.email}
                  pictureUrl={person.pictureUrl}
                  details={{
                    role: person.role ?? null,
                    description: person.description ?? null,
                  }}
                  canEdit={canEdit}
                  highlighted={
                    focus?.kind === 'member' && focus.id === person.id
                  }
                  onSave={(details) =>
                    run(() =>
                      updateProjectMember({
                        ...project,
                        userId: person.id,
                        ...details,
                      }),
                    )
                  }
                  onRemove={() =>
                    run(
                      () =>
                        removeProjectMember({ ...project, userId: person.id }),
                      'Removed from the project',
                    )
                  }
                />
              ))
            )}
            {canEdit && available.length > 0 ? (
              <Select
                value=""
                onValueChange={(userId) =>
                  void run(
                    () => addProjectMember({ ...project, userId }),
                    'Added to the team',
                  )
                }
              >
                <SelectTrigger className="h-9 w-full border-dashed border-[color:var(--workspace-shell-border)] bg-transparent text-sm">
                  <span className="flex items-center gap-2 text-[var(--workspace-shell-text-muted)]">
                    <UserPlus className="h-4 w-4" />
                    <SelectValue placeholder="Add a team member" />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {available.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name || member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </section>

          <section className="space-y-2">
            <SectionHeading title="Client & contacts" count={contacts.length} />
            {client ? (
              <div className="flex items-center gap-2 rounded-lg bg-[var(--workspace-shell-sidebar-accent)] px-3 py-2 text-xs text-[var(--workspace-shell-text-muted)]">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Client:{' '}
                  <span className="font-medium text-[var(--workspace-shell-text)]">
                    {client.displayName || client.companyName}
                  </span>
                  . Their contacts join the team automatically; manage them on
                  the client record.
                </span>
              </div>
            ) : null}
            {contacts.length === 0 ? (
              <EmptyHint>
                Add client contacts, consultants or suppliers working on this
                project.
              </EmptyHint>
            ) : (
              contacts.map((contact) => (
                <PersonRow
                  key={contact.id}
                  name={contact.name}
                  subtitle={[
                    contact.isClientContact ? 'Client contact' : null,
                    contact.companyName,
                    contact.email,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  pictureUrl={contact.pictureUrl}
                  details={{
                    role: contact.role,
                    description: contact.description,
                  }}
                  canEdit={canEdit}
                  highlighted={
                    focus?.kind === 'contact' && focus.id === contact.id
                  }
                  onSave={(details) =>
                    run(() =>
                      updateProjectContact({
                        ...project,
                        contactId: contact.id,
                        ...details,
                      }),
                    )
                  }
                  onRemove={
                    contact.isClientContact
                      ? undefined
                      : () =>
                          run(
                            () =>
                              removeProjectContact({
                                ...project,
                                contactId: contact.id,
                              }),
                            'Removed from the project',
                          )
                  }
                />
              ))
            )}
            {canEdit ? (
              <AddContact
                key={open ? 'open' : 'closed'}
                accountId={accountId}
                jobId={jobId}
                client={client}
                excludeIds={contacts.map((contact) => contact.id)}
                onAdd={(contactId) =>
                  run(
                    () => addProjectContact({ ...project, contactId }),
                    'Added to the project',
                  )
                }
                onCreate={(draft) =>
                  run(
                    () => createProjectContact({ ...project, ...draft }),
                    'Contact created and added',
                  )
                }
              />
            ) : null}
          </section>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {canEdit ? (
            <Button type="button" variant="outline" onClick={onLayoutSection}>
              <LayoutGrid className="mr-1.5 h-4 w-4" />
              Show team section on canvas
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionHeading({ title, count }: { title: string; count: number }) {
  return (
    <p className="text-xs font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
      {title} · {count}
    </p>
  );
}

function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-[color:var(--workspace-shell-border)] px-3 py-3 text-xs text-[var(--workspace-shell-text-muted)]">
      {children}
    </p>
  );
}

function PersonRow({
  name,
  subtitle,
  pictureUrl,
  details,
  canEdit,
  highlighted,
  onSave,
  onRemove,
}: {
  name: string;
  subtitle: string | null;
  pictureUrl: string | null;
  details: PersonDetails;
  canEdit: boolean;
  highlighted: boolean;
  onSave: (details: PersonDetails) => Promise<boolean>;
  onRemove?: () => Promise<boolean>;
}) {
  const [role, setRole] = useState(details.role ?? '');
  const [description, setDescription] = useState(details.description ?? '');
  const [busy, setBusy] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlighted) rowRef.current?.scrollIntoView({ block: 'center' });
  }, [highlighted]);

  // Follow saved changes per field, so saving one never resets the other mid-edit.
  const [seen, setSeen] = useState(details);
  if (seen.role !== details.role || seen.description !== details.description) {
    if (seen.role !== details.role) setRole(details.role ?? '');
    if (seen.description !== details.description) {
      setDescription(details.description ?? '');
    }
    setSeen(details);
  }

  const save = async () => {
    const next = {
      role: role.trim() || null,
      description: description.trim() || null,
    };
    if (
      next.role === (details.role ?? null) &&
      next.description === (details.description ?? null)
    ) {
      return;
    }
    setBusy(true);
    await onSave(next);
    setBusy(false);
  };

  return (
    <div
      ref={rowRef}
      className={cn(
        'space-y-2 rounded-xl border border-[color:var(--workspace-shell-border)] p-3',
        highlighted && 'border-[var(--ozer-accent)]',
        busy && 'opacity-70',
      )}
    >
      <div className="flex items-center gap-2.5">
        <ProfileAvatar
          displayName={name}
          pictureUrl={pictureUrl}
          className="h-8 w-8 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{name}</p>
          {subtitle ? (
            <p className="truncate text-[11px] text-[var(--workspace-shell-text-muted)]">
              {subtitle}
            </p>
          ) : null}
        </div>
        {canEdit && onRemove ? (
          <button
            type="button"
            onClick={() => void onRemove()}
            className="rounded-md p-1 text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]"
            aria-label={`Remove ${name} from the project`}
            title="Remove from project"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {canEdit ? (
        <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
          <Input
            value={role}
            list={ROLE_LIST_ID}
            maxLength={120}
            placeholder="Role"
            autoFocus={highlighted}
            onChange={(event) => setRole(event.target.value)}
            onBlur={() => void save()}
            className="h-9 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-sm"
          />
          <Textarea
            value={description}
            maxLength={1000}
            rows={2}
            placeholder="What they're responsible for, how best to reach them…"
            onChange={(event) => setDescription(event.target.value)}
            onBlur={() => void save()}
            className="min-h-9 resize-y border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-sm"
          />
        </div>
      ) : details.role || details.description ? (
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          {[details.role, details.description].filter(Boolean).join(' — ')}
        </p>
      ) : null}
    </div>
  );
}

type NewContactDraft = {
  name: string;
  email: string;
  companyName: string;
  linkToClient: boolean;
};

function AddContact({
  accountId,
  jobId,
  client,
  excludeIds,
  onAdd,
  onCreate,
}: {
  accountId: string;
  jobId: string;
  client: CanvasClient | null;
  excludeIds: string[];
  onAdd: (contactId: string) => Promise<boolean>;
  onCreate: (draft: NewContactDraft) => Promise<boolean>;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProjectContactCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<NewContactDraft>({
    name: '',
    email: '',
    companyName: '',
    linkToClient: Boolean(client),
  });

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      searchProjectContacts({ accountId, jobId, query })
        .then((found) => {
          if (!cancelled) setResults(found);
        })
        .catch((error: unknown) => {
          if (!cancelled) toast.error(getErrorMessage(error));
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [accountId, jobId, query]);

  const visible = results.filter((result) => !excludeIds.includes(result.id));

  if (creating) {
    return (
      <form
        className="space-y-2 rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] p-3"
        onSubmit={async (event) => {
          event.preventDefault();
          if (await onCreate(draft)) {
            setCreating(false);
            setDraft({
              name: '',
              email: '',
              companyName: '',
              linkToClient: Boolean(client),
            });
          }
        }}
      >
        <p className="text-xs font-semibold">New contact</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <Input
            required
            autoFocus
            value={draft.name}
            maxLength={200}
            placeholder="Full name"
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, name: event.target.value }))
            }
            className="h-9"
          />
          <Input
            type="email"
            value={draft.email}
            placeholder="Email"
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, email: event.target.value }))
            }
            className="h-9"
          />
          <Input
            value={draft.companyName}
            maxLength={200}
            placeholder="Company"
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, companyName: event.target.value }))
            }
            className="h-9"
          />
        </div>
        {client ? (
          <label className="flex items-center gap-2 text-xs text-[var(--workspace-shell-text-muted)]">
            <Checkbox
              checked={draft.linkToClient}
              onCheckedChange={(checked) =>
                setDraft((prev) => ({
                  ...prev,
                  linkToClient: checked === true,
                }))
              }
            />
            Also add as a contact of {client.displayName || client.companyName}
          </label>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setCreating(false)}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={!draft.name.trim()}>
            Create & add
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-1.5 rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] p-2">
      <div className="flex items-center gap-2">
        <Input
          value={query}
          placeholder="Search contacts to add…"
          onChange={(event) => setQuery(event.target.value)}
          className="h-9 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setDraft((prev) => ({ ...prev, name: query.trim() }));
            setCreating(true);
          }}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          New contact
        </Button>
      </div>
      <ul className="max-h-48 space-y-0.5 overflow-y-auto">
        {visible.map((candidate) => (
          <li key={candidate.id}>
            <button
              type="button"
              onClick={() => void onAdd(candidate.id)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[var(--workspace-shell-sidebar-accent)]"
            >
              <ProfileAvatar
                displayName={candidate.name}
                pictureUrl={candidate.pictureUrl}
                className="h-6 w-6 shrink-0 text-[10px]"
              />
              <span className="min-w-0 flex-1 truncate text-sm">
                {candidate.name}
                <span className="ml-1.5 text-[11px] text-[var(--workspace-shell-text-muted)]">
                  {[candidate.companyName, candidate.email]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
            </button>
          </li>
        ))}
        {!searching && visible.length === 0 ? (
          <li className="px-2 py-1.5 text-xs text-[var(--workspace-shell-text-muted)]">
            {query ? 'No matching contacts.' : 'No contacts to suggest yet.'}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
