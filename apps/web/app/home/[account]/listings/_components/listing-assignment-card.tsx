'use client';

import { useMemo, useState, useTransition } from 'react';

import { Plus, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';

import { workspacePanelCard } from '~/lib/workspace-ui';

import type {
  ListingAssignment,
  ListingMemberOption,
  WorkspaceTeam,
} from '../_lib/server/listings.service';
import {
  createWorkspaceTeam,
  updateListingAssignment,
} from '../_lib/server/server-actions';

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

function MemberSelect({
  id,
  label,
  members,
  value,
  allowClear,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  members: ListingMemberOption[];
  value: string | null;
  allowClear?: boolean;
  disabled?: boolean;
  onChange: (userId: string | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        disabled={disabled}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
      >
        <option value="">{allowClear ? 'None' : 'Select…'}</option>
        {members.map((member) => (
          <option key={member.userId} value={member.userId}>
            {member.name}
          </option>
        ))}
      </select>
      {value ? (
        <div className="flex items-center gap-2 pt-1 text-sm text-[var(--workspace-shell-text)]/70">
          <MemberAvatar
            name={members.find((m) => m.userId === value)?.name ?? 'Member'}
            pictureUrl={
              members.find((m) => m.userId === value)?.pictureUrl ?? null
            }
          />
          <span>{members.find((m) => m.userId === value)?.name}</span>
        </div>
      ) : null}
    </div>
  );
}

export function ListingAssignmentCard({
  accountId,
  accountSlug,
  members: initialMembers,
  teams: initialTeams,
  assignment: initialAssignment,
}: {
  accountId: string;
  accountSlug: string;
  members: ListingMemberOption[];
  teams: WorkspaceTeam[];
  assignment: ListingAssignment;
}) {
  const [members] = useState(initialMembers);
  const [teams, setTeams] = useState(initialTeams);
  const [assignment, setAssignment] = useState(initialAssignment);
  const [agentQuery, setAgentQuery] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [addingTeam, setAddingTeam] = useState(false);
  const [pending, startTransition] = useTransition();

  const agentIds = useMemo(
    () => assignment.actingAgents.map((a) => a.userId),
    [assignment.actingAgents],
  );

  const availableAgents = useMemo(() => {
    const q = agentQuery.trim().toLowerCase();
    return members.filter((member) => {
      if (agentIds.includes(member.userId)) return false;
      if (!q) return true;
      return (
        member.name.toLowerCase().includes(q) ||
        (member.email?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [agentIds, agentQuery, members]);

  const persist = (patch: {
    actingAgentUserIds?: string[];
    paUserId?: string | null;
    recordOwnerUserId?: string | null;
    teamId?: string | null;
  }) => {
    startTransition(async () => {
      try {
        const updated = await updateListingAssignment({
          accountId,
          accountSlug,
          listingId: assignment.listingId,
          ...patch,
        });
        setAssignment(updated);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not save');
      }
    });
  };

  const addAgent = (userId: string) => {
    const next = [...agentIds, userId];
    setAgentQuery('');
    setAssignment((prev) => {
      const member = members.find((m) => m.userId === userId);
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
    persist({ actingAgentUserIds: next });
  };

  const removeAgent = (userId: string) => {
    const next = agentIds.filter((id) => id !== userId);
    setAssignment((prev) => ({
      ...prev,
      actingAgents: prev.actingAgents
        .filter((a) => a.userId !== userId)
        .map((a, index) => ({ ...a, sortOrder: index })),
    }));
    persist({ actingAgentUserIds: next });
  };

  const createTeam = () => {
    const name = newTeamName.trim();
    if (!name) return;
    startTransition(async () => {
      try {
        const team = await createWorkspaceTeam({ accountId, name });
        setTeams((prev) => {
          if (prev.some((t) => t.id === team.id)) return prev;
          return [...prev, team].sort((a, b) =>
            a.name.localeCompare(b.name, 'en'),
          );
        });
        setAssignment((prev) => ({
          ...prev,
          teamId: team.id,
          teamName: team.name,
        }));
        setNewTeamName('');
        setAddingTeam(false);
        await updateListingAssignment({
          accountId,
          accountSlug,
          listingId: assignment.listingId,
          teamId: team.id,
        });
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
          Assigned Users & Teams
        </CardTitle>
        <p className="text-sm text-[var(--workspace-shell-text)]/50">
          Who is responsible for this disposal.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-3">
            <Label>Acting Agents</Label>
            <Input
              placeholder="Search for a user…"
              value={agentQuery}
              disabled={pending}
              onChange={(e) => setAgentQuery(e.target.value)}
            />
            {agentQuery.trim() && availableAgents.length > 0 ? (
              <ul className="max-h-40 overflow-auto rounded-lg border border-[color:var(--workspace-shell-border)]">
                {availableAgents.slice(0, 8).map((member) => (
                  <li key={member.userId}>
                    <button
                      type="button"
                      disabled={pending}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--workspace-shell-sidebar-accent)]"
                      onClick={() => addAgent(member.userId)}
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
            <ul className="space-y-2">
              {assignment.actingAgents.length === 0 ? (
                <li className="text-sm text-[var(--workspace-shell-text)]/45">
                  No acting agents yet.
                </li>
              ) : (
                assignment.actingAgents.map((agent) => (
                  <li
                    key={agent.userId}
                    className="flex items-center gap-2 rounded-lg bg-[var(--workspace-shell-sidebar-accent)] px-2.5 py-2"
                  >
                    <MemberAvatar
                      name={agent.name}
                      pictureUrl={agent.pictureUrl}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                      {agent.name}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={pending}
                      className="h-7 w-7 shrink-0"
                      onClick={() => removeAgent(agent.userId)}
                      aria-label={`Remove ${agent.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="space-y-4">
            <MemberSelect
              id="listing-pa"
              label="PA"
              members={members}
              value={assignment.paUserId}
              allowClear
              disabled={pending}
              onChange={(userId) => {
                setAssignment((prev) => ({ ...prev, paUserId: userId }));
                persist({ paUserId: userId });
              }}
            />

            <div className="space-y-1.5">
              <Label htmlFor="listing-team">Teams</Label>
              <select
                id="listing-team"
                disabled={pending}
                value={assignment.teamId ?? ''}
                onChange={(e) => {
                  const teamId = e.target.value || null;
                  setAssignment((prev) => ({
                    ...prev,
                    teamId,
                    teamName: teams.find((t) => t.id === teamId)?.name ?? null,
                  }));
                  persist({ teamId });
                }}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                <option value="">None</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              {addingTeam ? (
                <div className="flex gap-2 pt-1">
                  <Input
                    placeholder="Team name"
                    value={newTeamName}
                    disabled={pending}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        createTeam();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending || !newTeamName.trim()}
                    onClick={createTeam}
                  >
                    Add
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => {
                      setAddingTeam(false);
                      setNewTeamName('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  className="mt-1 gap-1.5"
                  onClick={() => setAddingTeam(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add team…
                </Button>
              )}
            </div>

            <MemberSelect
              id="listing-record-owner"
              label="Record Owner"
              members={members}
              value={assignment.recordOwnerUserId}
              allowClear
              disabled={pending}
              onChange={(userId) => {
                setAssignment((prev) => ({
                  ...prev,
                  recordOwnerUserId: userId,
                }));
                persist({ recordOwnerUserId: userId });
              }}
            />
          </div>

          <div className="rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]/40 p-4 text-sm text-[var(--workspace-shell-text)]/55">
            Assignments are saved as you change them. Acting agents appear on
            the disposal for your team; PA and record owner mark who owns the
            day-to-day relationship.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
