'use client';

import { useMemo, useState, useTransition } from 'react';

import { UserRound, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';

import { workspacePanelCard } from '~/lib/workspace-ui';

import type {
  ListingAssignment,
  ListingMemberOption,
} from '../_lib/server/listings.service';
import { updateListingAssignment } from '../_lib/server/server-actions';

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

export function ListingAssignmentCard({
  accountId,
  accountSlug,
  members: initialMembers,
  assignment: initialAssignment,
}: {
  accountId: string;
  accountSlug: string;
  members: ListingMemberOption[];
  assignment: ListingAssignment;
}) {
  const [members] = useState(initialMembers);
  const [assignment, setAssignment] = useState(initialAssignment);
  const [agentQuery, setAgentQuery] = useState('');
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

  const persistAgents = (actingAgentUserIds: string[]) => {
    startTransition(async () => {
      try {
        const updated = await updateListingAssignment({
          accountId,
          accountSlug,
          listingId: assignment.listingId,
          actingAgentUserIds,
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
    persistAgents(next);
  };

  const removeAgent = (userId: string) => {
    const next = agentIds.filter((id) => id !== userId);
    setAssignment((prev) => ({
      ...prev,
      actingAgents: prev.actingAgents
        .filter((a) => a.userId !== userId)
        .map((a, index) => ({ ...a, sortOrder: index })),
    }));
    persistAgents(next);
  };

  return (
    <Card className={workspacePanelCard}>
      <CardHeader>
        <CardTitle className="text-base text-[var(--workspace-shell-text)]">
          Acting Agents
        </CardTitle>
        <p className="text-sm text-[var(--workspace-shell-text)]/50">
          Workspace members acting on this disposal.
        </p>
      </CardHeader>
      <CardContent className="max-w-md space-y-3">
        <Label htmlFor="acting-agent-search">Add agent</Label>
        <Input
          id="acting-agent-search"
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
                <MemberAvatar name={agent.name} pictureUrl={agent.pictureUrl} />
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
      </CardContent>
    </Card>
  );
}
