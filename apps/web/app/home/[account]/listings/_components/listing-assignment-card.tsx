'use client';

import { useMemo, useState, useTransition } from 'react';

import { ArrowDown, ArrowUp, UserRound, X } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Checkbox } from '@kit/ui/checkbox';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';

import {
  workspacePanelCard,
  workspaceSelectContentClass,
  workspaceSelectItemClass,
} from '~/lib/workspace-ui';

import type {
  ListingAssignment,
  ListingMemberOption,
  WorkspaceTeam,
} from '../_lib/server/listings.service';
import {
  createWorkspaceTeam,
  updateListingAssignment,
} from '../_lib/server/server-actions';

export type ListingBranchOption = {
  id: string;
  name: string;
  rightmoveBranchId: string | null;
};

function MemberAvatar({
  name,
  pictureUrl,
}: {
  name: string;
  pictureUrl: string | null;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  if (pictureUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote member avatars; Next Image domains not configured for all sources
      <img
        src={pictureUrl}
        alt=""
        className="h-7 w-7 rounded-full object-cover"
      />
    );
  }

  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--workspace-shell-sidebar-accent)] text-[10px] font-semibold text-[var(--workspace-shell-text)]/70">
      {initials || <UserRound className="h-3.5 w-3.5" />}
    </span>
  );
}

function MemberSearchAdd({
  id,
  label,
  members,
  excludedIds,
  onPick,
  disabled,
}: {
  id: string;
  label: string;
  members: ListingMemberOption[];
  excludedIds: string[];
  onPick: (userId: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((member) => {
      if (excludedIds.includes(member.userId)) return false;
      if (!q) return true;
      return (
        member.name.toLowerCase().includes(q) ||
        (member.email?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [excludedIds, members, query]);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        placeholder="Search for a user…"
        value={query}
        disabled={disabled}
        onChange={(e) => setQuery(e.target.value)}
      />
      {query.trim() && available.length > 0 ? (
        <ul className="max-h-40 overflow-auto rounded-lg border border-[color:var(--workspace-shell-border)]">
          {available.slice(0, 8).map((member) => (
            <li key={member.userId}>
              <button
                type="button"
                disabled={disabled}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--workspace-shell-sidebar-accent)]"
                onClick={() => {
                  onPick(member.userId);
                  setQuery('');
                }}
              >
                <MemberAvatar
                  name={member.name}
                  pictureUrl={member.pictureUrl}
                />
                <span className="min-w-0 truncate">{member.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SelectedMemberChip({
  member,
  onClear,
  disabled,
}: {
  member: ListingMemberOption | null;
  onClear: () => void;
  disabled?: boolean;
}) {
  if (!member) {
    return (
      <p className="text-sm text-[var(--workspace-shell-text)]/45">Not set</p>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg bg-[var(--workspace-shell-sidebar-accent)] px-2.5 py-2">
      <MemberAvatar name={member.name} pictureUrl={member.pictureUrl} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--workspace-shell-text)]">
        {member.name}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled}
        className="h-7 w-7 shrink-0"
        onClick={onClear}
        aria-label={`Clear ${member.name}`}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function ListingAssignmentCard({
  accountId,
  accountSlug,
  members: initialMembers,
  teams: initialTeams,
  branches: initialBranches,
  assignment: initialAssignment,
}: {
  accountId: string;
  accountSlug: string;
  members: ListingMemberOption[];
  teams: WorkspaceTeam[];
  branches: ListingBranchOption[];
  assignment: ListingAssignment;
}) {
  const [members] = useState(initialMembers);
  const [teams, setTeams] = useState(initialTeams);
  const [branches] = useState(initialBranches);
  const [assignment, setAssignment] = useState(initialAssignment);
  const [newTeamName, setNewTeamName] = useState('');
  const [pending, startTransition] = useTransition();

  const memberById = useMemo(
    () => new Map(members.map((m) => [m.userId, m])),
    [members],
  );

  const agentIds = useMemo(
    () => assignment.actingAgents.map((a) => a.userId),
    [assignment.actingAgents],
  );

  const persist = (
    patch: Parameters<typeof updateListingAssignment>[0] extends infer T
      ? Omit<T, 'accountId' | 'accountSlug' | 'listingId'>
      : never,
    optimistic?: (prev: ListingAssignment) => ListingAssignment,
  ) => {
    const previous = assignment;
    if (optimistic) {
      setAssignment(optimistic);
    }
    startTransition(async () => {
      try {
        const updated = await updateListingAssignment({
          accountId,
          accountSlug,
          listingId: previous.listingId,
          ...patch,
        });
        setAssignment(updated);
      } catch (err) {
        setAssignment(previous);
        toast.error(err instanceof Error ? err.message : 'Could not save');
      }
    });
  };

  const addAgent = (userId: string) => {
    const next = [...agentIds, userId];
    persist({ actingAgentUserIds: next }, (prev) => {
      const member = memberById.get(userId);
      return {
        ...prev,
        actingAgents: [
          ...prev.actingAgents,
          {
            userId,
            name: member?.name ?? 'Team member',
            email: member?.email ?? null,
            pictureUrl: member?.pictureUrl ?? null,
            sortOrder: prev.actingAgents.length,
          },
        ],
      };
    });
  };

  const removeAgent = (userId: string) => {
    const next = agentIds.filter((id) => id !== userId);
    persist({ actingAgentUserIds: next }, (prev) => ({
      ...prev,
      actingAgents: prev.actingAgents
        .filter((a) => a.userId !== userId)
        .map((a, index) => ({ ...a, sortOrder: index })),
    }));
  };

  const moveAgent = (userId: string, direction: -1 | 1) => {
    const index = agentIds.indexOf(userId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= agentIds.length) return;
    const next = [...agentIds];
    const tmp = next[index]!;
    next[index] = next[target]!;
    next[target] = tmp;
    persist({ actingAgentUserIds: next }, (prev) => {
      const agents = [...prev.actingAgents];
      const a = agents[index]!;
      agents[index] = agents[target]!;
      agents[target] = a;
      return {
        ...prev,
        actingAgents: agents.map((agent, i) => ({
          ...agent,
          sortOrder: i,
        })),
      };
    });
  };

  const createTeam = () => {
    const name = newTeamName.trim();
    if (!name) return;
    startTransition(async () => {
      try {
        const team = await createWorkspaceTeam({ accountId, name });
        setTeams((prev) => [...prev, team]);
        setNewTeamName('');
        const updated = await updateListingAssignment({
          accountId,
          accountSlug,
          listingId: assignment.listingId,
          teamId: team.id,
        });
        setAssignment(updated);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Could not create team',
        );
      }
    });
  };

  return (
    <Card className={workspacePanelCard}>
      <CardHeader>
        <CardTitle className="text-base text-[var(--workspace-shell-text)]">
          Assigned users & teams
        </CardTitle>
        <p className="text-sm text-[var(--workspace-shell-text)]/50">
          Workspace members acting on this disposal, plus PA, record owner and
          team.
        </p>
      </CardHeader>
      <CardContent className="max-w-lg space-y-6">
        <div className="space-y-3">
          <MemberSearchAdd
            id="acting-agent-search"
            label="Acting agents"
            members={members}
            excludedIds={agentIds}
            disabled={pending}
            onPick={addAgent}
          />
          <ul className="space-y-2">
            {assignment.actingAgents.length === 0 ? (
              <li className="text-sm text-[var(--workspace-shell-text)]/45">
                No acting agents yet.
              </li>
            ) : (
              assignment.actingAgents.map((agent, index) => (
                <li key={agent.userId} className="flex items-center gap-1">
                  <div className="flex flex-col">
                    <button
                      type="button"
                      className="text-[var(--workspace-shell-text)]/40 hover:text-[var(--workspace-shell-text)] disabled:opacity-30"
                      aria-label={`Move ${agent.name} up`}
                      disabled={pending || index === 0}
                      onClick={() => moveAgent(agent.userId, -1)}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="text-[var(--workspace-shell-text)]/40 hover:text-[var(--workspace-shell-text)] disabled:opacity-30"
                      aria-label={`Move ${agent.name} down`}
                      disabled={
                        pending || index === assignment.actingAgents.length - 1
                      }
                      onClick={() => moveAgent(agent.userId, 1)}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <SelectedMemberChip
                    member={{
                      userId: agent.userId,
                      name: agent.name,
                      email: agent.email,
                      pictureUrl: agent.pictureUrl,
                    }}
                    disabled={pending}
                    onClear={() => removeAgent(agent.userId)}
                  />
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="space-y-2">
          <MemberSearchAdd
            id="pa-search"
            label="PA"
            members={members}
            excludedIds={assignment.paUserId ? [assignment.paUserId] : []}
            disabled={pending}
            onPick={(userId) =>
              persist({ paUserId: userId }, (prev) => ({
                ...prev,
                paUserId: userId,
              }))
            }
          />
          <SelectedMemberChip
            member={
              assignment.paUserId
                ? (memberById.get(assignment.paUserId) ?? null)
                : null
            }
            disabled={pending}
            onClear={() =>
              persist({ paUserId: null }, (prev) => ({
                ...prev,
                paUserId: null,
              }))
            }
          />
        </div>

        <div className="space-y-2">
          <MemberSearchAdd
            id="owner-search"
            label="Record owner"
            members={members}
            excludedIds={
              assignment.recordOwnerUserId ? [assignment.recordOwnerUserId] : []
            }
            disabled={pending}
            onPick={(userId) =>
              persist({ recordOwnerUserId: userId }, (prev) => ({
                ...prev,
                recordOwnerUserId: userId,
              }))
            }
          />
          <SelectedMemberChip
            member={
              assignment.recordOwnerUserId
                ? (memberById.get(assignment.recordOwnerUserId) ?? null)
                : null
            }
            disabled={pending}
            onClear={() =>
              persist({ recordOwnerUserId: null }, (prev) => ({
                ...prev,
                recordOwnerUserId: null,
              }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="branch-select">Office / branch</Label>
          <Select
            value={assignment.accountBranchId ?? '__none__'}
            disabled={pending}
            onValueChange={(value) =>
              persist(
                { accountBranchId: value === '__none__' ? null : value },
                (prev) => ({
                  ...prev,
                  accountBranchId: value === '__none__' ? null : value,
                  accountBranchName:
                    value === '__none__'
                      ? null
                      : (branches.find((b) => b.id === value)?.name ?? null),
                }),
              )
            }
          >
            <SelectTrigger id="branch-select">
              <SelectValue placeholder="Select branch" />
            </SelectTrigger>
            <SelectContent className={workspaceSelectContentClass}>
              <SelectItem value="__none__" className={workspaceSelectItemClass}>
                No branch
              </SelectItem>
              {branches.map((branch) => (
                <SelectItem
                  key={branch.id}
                  value={branch.id}
                  className={workspaceSelectItemClass}
                >
                  {branch.name}
                  {branch.rightmoveBranchId
                    ? ` · RM ${branch.rightmoveBranchId}`
                    : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-[var(--workspace-shell-text)]/45">
            Required for Rightmove publish. Set each office&apos;s Rightmove
            Branch ID under Brand settings → Branches.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="team-select">Team</Label>
          <Select
            value={assignment.teamId ?? '__none__'}
            disabled={pending}
            onValueChange={(value) =>
              persist(
                { teamId: value === '__none__' ? null : value },
                (prev) => ({
                  ...prev,
                  teamId: value === '__none__' ? null : value,
                  teamName:
                    value === '__none__'
                      ? null
                      : (teams.find((t) => t.id === value)?.name ?? null),
                }),
              )
            }
          >
            <SelectTrigger id="team-select">
              <SelectValue placeholder="Select team" />
            </SelectTrigger>
            <SelectContent className={workspaceSelectContentClass}>
              <SelectItem value="__none__" className={workspaceSelectItemClass}>
                No team
              </SelectItem>
              {teams.map((team) => (
                <SelectItem
                  key={team.id}
                  value={team.id}
                  className={workspaceSelectItemClass}
                >
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input
              placeholder="New team name…"
              value={newTeamName}
              disabled={pending}
              onChange={(e) => setNewTeamName(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              disabled={pending || !newTeamName.trim()}
              onClick={createTeam}
            >
              Add
            </Button>
          </div>
        </div>

        <label className="flex items-start gap-2.5 text-sm text-[var(--workspace-shell-text)]">
          <Checkbox
            checked={assignment.restrictAccessToAssigned}
            disabled={pending}
            onCheckedChange={(checked) =>
              persist(
                { restrictAccessToAssigned: checked === true },
                (prev) => ({
                  ...prev,
                  restrictAccessToAssigned: checked === true,
                }),
              )
            }
          />
          <span>
            Restrict access to assigned users &amp; the PA
            <span className="mt-0.5 block text-xs text-[var(--workspace-shell-text)]/50">
              Preference stored on the disposal; full enforcement rolls out with
              workspace permissions.
            </span>
          </span>
        </label>
      </CardContent>
    </Card>
  );
}
