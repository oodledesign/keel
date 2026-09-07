'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Building2, FolderKanban, UserRound, X } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import {
  type ComposeEntity,
  type ComposePerson,
  formatWhoCanSee,
  inferComposeType,
} from '~/lib/messages/compose-thread';
import {
  workspaceBtnPrimary,
  workspaceControlSurface,
  workspaceInsetSurface,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { createMessageThread } from '../_lib/server/server-actions';

export type NewChatMemberOption = {
  userId: string;
  email: string;
  name: string;
  role: string | null;
};

export type NewChatContactOption = {
  contactId: string;
  clientId: string;
  clientName: string;
  name: string;
  email: string | null;
  portalEnabled: boolean;
};

export type NewChatClientOption = {
  clientId: string;
  name: string;
};

export type NewChatProjectOption = {
  id: string;
  title: string;
  clientId: string | null;
  assigneeUserIds: string[];
};

type SearchHit =
  | { kind: 'member'; id: string; title: string; subtitle: string }
  | { kind: 'contact'; id: string; title: string; subtitle: string }
  | { kind: 'client'; id: string; title: string; subtitle: string }
  | { kind: 'project'; id: string; title: string; subtitle: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  userId: string;
  canMessageClients: boolean;
  memberOptions: NewChatMemberOption[];
  contactOptions: NewChatContactOption[];
  clientOptions: NewChatClientOption[];
  projectOptions: NewChatProjectOption[];
  initialProjectId?: string;
  initialClientId?: string;
  initialContactIds?: string[];
  onCreated: (threadId: string) => Promise<void> | void;
};

export function NewChatDialog(props: Props) {
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('');
  const [people, setPeople] = useState<ComposePerson[]>([]);
  const [entity, setEntity] = useState<ComposeEntity | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const memberById = useMemo(
    () => new Map(props.memberOptions.map((m) => [m.userId, m])),
    [props.memberOptions],
  );
  const contactById = useMemo(
    () => new Map(props.contactOptions.map((c) => [c.contactId, c])),
    [props.contactOptions],
  );
  const clientById = useMemo(
    () => new Map(props.clientOptions.map((c) => [c.clientId, c])),
    [props.clientOptions],
  );
  const projectById = useMemo(
    () => new Map(props.projectOptions.map((p) => [p.id, p])),
    [props.projectOptions],
  );

  function resetFromInitial() {
    const nextPeople: ComposePerson[] = [];
    let nextEntity: ComposeEntity | null = null;

    const project = props.initialProjectId
      ? projectById.get(props.initialProjectId)
      : undefined;
    const client = props.initialClientId
      ? clientById.get(props.initialClientId)
      : undefined;

    if (project) {
      nextEntity = { kind: 'project', id: project.id, name: project.title };
      nextPeople.push(...peopleForProject(project, props));
    } else if (client && props.canMessageClients) {
      nextEntity = { kind: 'client', id: client.clientId, name: client.name };
    }

    for (const contactId of props.initialContactIds ?? []) {
      const contact = contactById.get(contactId);
      if (!contact) continue;
      if (nextPeople.some((p) => p.kind === 'contact' && p.id === contactId)) {
        continue;
      }
      nextPeople.push({
        kind: 'contact',
        id: contact.contactId,
        name: contact.name,
      });
    }

    setPeople(nextPeople);
    setEntity(nextEntity);
    setTitle('');
    setQuery('');
    setListOpen(false);
  }

  useEffect(() => {
    if (props.open) resetFromInitial();
    // Reset only when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);

  const hits = useMemo(() => {
    const selectedMemberIds = new Set(
      people.filter((p) => p.kind === 'member').map((p) => p.id),
    );
    const selectedContactIds = new Set(
      people.filter((p) => p.kind === 'contact').map((p) => p.id),
    );
    const q = query.trim().toLowerCase();
    const out: SearchHit[] = [];

    for (const member of props.memberOptions) {
      if (member.userId === props.userId) continue;
      if (selectedMemberIds.has(member.userId)) continue;
      if (
        q &&
        !`${member.name} ${member.email} ${member.role ?? ''}`
          .toLowerCase()
          .includes(q)
      ) {
        continue;
      }
      out.push({
        kind: 'member',
        id: member.userId,
        title: member.name || member.email,
        subtitle: member.email,
      });
    }

    if (props.canMessageClients && entity?.kind !== 'client') {
      for (const contact of props.contactOptions) {
        if (selectedContactIds.has(contact.contactId)) continue;
        if (
          q &&
          !`${contact.name} ${contact.email ?? ''} ${contact.clientName}`
            .toLowerCase()
            .includes(q)
        ) {
          continue;
        }
        out.push({
          kind: 'contact',
          id: contact.contactId,
          title: contact.name,
          subtitle: `${contact.clientName}${contact.portalEnabled ? '' : ' · no portal'}`,
        });
      }
    }

    if (props.canMessageClients && !entity) {
      for (const client of props.clientOptions) {
        if (q && !client.name.toLowerCase().includes(q)) {
          continue;
        }
        out.push({
          kind: 'client',
          id: client.clientId,
          title: client.name,
          subtitle: 'Whole client — all portal contacts',
        });
      }
    }

    if (!entity) {
      for (const project of props.projectOptions) {
        if (q && !project.title.toLowerCase().includes(q)) continue;
        out.push({
          kind: 'project',
          id: project.id,
          title: project.title,
          subtitle: 'Project thread',
        });
      }
    }

    return out.slice(0, 20);
  }, [
    query,
    people,
    props.memberOptions,
    props.contactOptions,
    props.clientOptions,
    props.projectOptions,
    props.canMessageClients,
    props.userId,
    entity,
  ]);

  const inferred = inferComposeType({ people, entity });
  const whoCanSee = formatWhoCanSee({ people, entity });

  function addHit(hit: SearchHit) {
    if (hit.kind === 'member') {
      const member = memberById.get(hit.id);
      if (!member) return;
      setPeople((prev) => [
        ...prev,
        { kind: 'member', id: member.userId, name: member.name },
      ]);
    } else if (hit.kind === 'contact') {
      const contact = contactById.get(hit.id);
      if (!contact) return;
      setPeople((prev) => [
        ...prev,
        { kind: 'contact', id: contact.contactId, name: contact.name },
      ]);
    } else if (hit.kind === 'client') {
      const client = clientById.get(hit.id);
      if (!client) return;
      setEntity({ kind: 'client', id: client.clientId, name: client.name });
      setPeople((prev) => prev.filter((p) => p.kind === 'member'));
    } else {
      const project = projectById.get(hit.id);
      if (!project) return;
      setEntity({ kind: 'project', id: project.id, name: project.title });
      setPeople((prev) => {
        const extras = peopleForProject(project, props);
        const seen = new Set(prev.map((p) => `${p.kind}:${p.id}`));
        const merged = [...prev];
        for (const person of extras) {
          const key = `${person.kind}:${person.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(person);
        }
        return merged;
      });
    }
    setQuery('');
    inputRef.current?.focus();
  }

  function removePerson(person: ComposePerson) {
    setPeople((prev) =>
      prev.filter((row) => !(row.kind === person.kind && row.id === person.id)),
    );
  }

  async function onCreate() {
    if (!inferred.type) {
      toast.error(inferred.error ?? 'Add a recipient');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createMessageThread({
        accountId: props.accountId,
        userId: props.userId,
        type: inferred.type,
        title: title.trim() || undefined,
        jobId: entity?.kind === 'project' ? entity.id : null,
        clientId: entity?.kind === 'client' ? entity.id : undefined,
        memberUserIds: people
          .filter((p) => p.kind === 'member')
          .map((p) => p.id),
        contactIds: people.filter((p) => p.kind === 'contact').map((p) => p.id),
      });

      if (!result?.ok) {
        toast.error(result?.error ?? 'Failed to create chat');
        return;
      }

      props.onOpenChange(false);
      await props.onCreated(result.threadId);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to create chat',
      );
    } finally {
      setSubmitting(false);
    }
  }

  const groupedHits = groupHits(hits);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-lg"
        data-test="new-chat-dialog"
      >
        <DialogHeader>
          <DialogTitle>New chat</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label className={workspaceTextMuted}>To</Label>
            <div
              className={cn(
                'flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-[color:var(--workspace-shell-border)] px-2 py-1.5',
                workspaceControlSurface,
              )}
              onClick={() => inputRef.current?.focus()}
            >
              {entity ? (
                <RecipientChip
                  label={entity.name}
                  kind={entity.kind}
                  onRemove={() => setEntity(null)}
                />
              ) : null}
              {people.map((person) => (
                <RecipientChip
                  key={`${person.kind}-${person.id}`}
                  label={person.name}
                  kind={person.kind}
                  onRemove={() => removePerson(person)}
                />
              ))}
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setListOpen(true);
                }}
                onFocus={() => setListOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !query) {
                    if (people.length > 0) {
                      setPeople((prev) => prev.slice(0, -1));
                    } else if (entity) {
                      setEntity(null);
                    }
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (hits[0]) addHit(hits[0]);
                  }
                  if (e.key === 'Escape') {
                    setListOpen(false);
                  }
                }}
                placeholder={
                  people.length || entity
                    ? 'Add another…'
                    : 'Search people, clients, or projects'
                }
                className="min-w-[10rem] flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-[var(--workspace-shell-text-muted)]"
                data-test="new-chat-recipient-input"
                aria-label="Search recipients"
              />
            </div>

            {listOpen ? (
              <div
                className="overflow-hidden rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]"
                data-test="new-chat-search-results"
              >
                {hits.length === 0 ? (
                  <p className={cn('px-3 py-3 text-sm', workspaceTextMuted)}>
                    {query.trim()
                      ? 'No matches.'
                      : 'Start typing a name, client, or project.'}
                  </p>
                ) : (
                  <ul className="max-h-64 overflow-y-auto py-1">
                    {groupedHits.map((group) => (
                      <li key={group.label}>
                        <p
                          className={cn(
                            'px-3 pt-2 pb-1 text-[10px] font-semibold tracking-wide uppercase',
                            workspaceTextMuted,
                          )}
                        >
                          {group.label}
                        </p>
                        {group.hits.map((hit) => (
                          <button
                            key={`${hit.kind}-${hit.id}`}
                            type="button"
                            className={cn(
                              'flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors',
                              workspaceText,
                              'hover:bg-[var(--workspace-shell-sidebar-accent)]',
                            )}
                            onClick={() => addHit(hit)}
                          >
                            <HitIcon kind={hit.kind} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">
                                {hit.title}
                              </span>
                              <span
                                className={cn(
                                  'block truncate text-xs',
                                  workspaceTextMuted,
                                )}
                              >
                                {hit.subtitle}
                              </span>
                            </span>
                          </button>
                        ))}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-chat-title" className={workspaceTextMuted}>
              Title (optional)
            </Label>
            <Input
              id="new-chat-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onFocus={() => setListOpen(false)}
              placeholder="Chat name"
              className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]"
            />
          </div>

          <div
            className={cn(
              'rounded-xl border border-[color:var(--workspace-shell-border)] px-3 py-3',
              workspaceInsetSurface,
            )}
            data-test="new-chat-visibility"
          >
            <p
              className={cn(
                'text-[10px] font-semibold tracking-wide uppercase',
                workspaceTextMuted,
              )}
            >
              Who can see this
            </p>
            <p className={cn('mt-1 text-sm font-medium', workspaceText)}>
              {whoCanSee}
            </p>
          </div>

          <Button
            type="button"
            className={cn('w-full border-0', workspaceBtnPrimary)}
            onClick={() => void onCreate()}
            disabled={submitting || !inferred.type}
            data-test="new-chat-create"
          >
            {submitting ? 'Creating…' : 'Create chat'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function peopleForProject(
  project: NewChatProjectOption,
  props: Pick<
    Props,
    'userId' | 'memberOptions' | 'contactOptions' | 'canMessageClients'
  >,
): ComposePerson[] {
  const people: ComposePerson[] = [];

  for (const userId of project.assigneeUserIds) {
    if (userId === props.userId) continue;
    const member = props.memberOptions.find((m) => m.userId === userId);
    if (!member) continue;
    people.push({ kind: 'member', id: member.userId, name: member.name });
  }

  if (props.canMessageClients && project.clientId) {
    for (const contact of props.contactOptions) {
      if (contact.clientId !== project.clientId || !contact.portalEnabled) {
        continue;
      }
      people.push({
        kind: 'contact',
        id: contact.contactId,
        name: contact.name,
      });
    }
  }

  return people;
}

function groupHits(hits: SearchHit[]) {
  const order = [
    { kind: 'member', label: 'Team' },
    { kind: 'contact', label: 'Contacts' },
    { kind: 'client', label: 'Clients' },
    { kind: 'project', label: 'Projects' },
  ] as const;

  return order
    .map((group) => ({
      label: group.label,
      hits: hits.filter((hit) => hit.kind === group.kind),
    }))
    .filter((group) => group.hits.length > 0);
}

function RecipientChip({
  label,
  kind,
  onRemove,
}: {
  label: string;
  kind: ComposePerson['kind'] | ComposeEntity['kind'];
  onRemove: () => void;
}) {
  return (
    <span
      className="inline-flex max-w-full items-center gap-1 rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-2 py-0.5 text-xs text-[var(--workspace-shell-text)]"
      data-test={`new-chat-chip-${kind}`}
    >
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="rounded-full p-0.5 text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]"
        aria-label={`Remove ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function HitIcon({ kind }: { kind: SearchHit['kind'] }) {
  const className =
    'mt-0.5 h-4 w-4 shrink-0 text-[var(--workspace-shell-text-muted)]';
  if (kind === 'client') return <Building2 className={className} />;
  if (kind === 'project') return <FolderKanban className={className} />;
  return <UserRound className={className} />;
}
