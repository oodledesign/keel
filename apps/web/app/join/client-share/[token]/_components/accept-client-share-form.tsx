'use client';

import { useEffect, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import {
  acceptClientWorkspaceShareAction,
  listAcceptableWorkspacesAction,
} from '~/lib/clients/client-workspace-shares-actions';
import type { ShareCapabilities } from '~/lib/clients/client-workspace-shares.service';

const MODULE_LABELS: Array<{ key: keyof ShareCapabilities; label: string }> = [
  { key: 'canSupport', label: 'Support' },
  { key: 'canContacts', label: 'Contacts' },
  { key: 'canProjects', label: 'Projects' },
  { key: 'canDocs', label: 'Docs' },
  { key: 'canFinance', label: 'Finance' },
  { key: 'canPortal', label: 'Portal' },
];

export function AcceptClientShareForm({
  token,
  capabilities,
  invitedEmail,
}: {
  token: string;
  capabilities: ShareCapabilities;
  invitedEmail: string | null;
}) {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<
    Array<{ id: string; slug: string; name: string }>
  >([]);
  const [guestAccountId, setGuestAccountId] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    void listAcceptableWorkspacesAction({})
      .then(
        (
          rows: Array<{
            id: string;
            slug: string;
            name: string;
          }>,
        ) => {
          setWorkspaces(rows);
          if (rows[0]) setGuestAccountId(rows[0].id);
        },
      )
      .catch(() => setWorkspaces([]))
      .finally(() => setLoading(false));
  }, []);

  const enabled = MODULE_LABELS.filter((module) => capabilities[module.key]);

  function accept() {
    if (!guestAccountId) {
      toast.error('Choose a workspace');
      return;
    }

    startTransition(async () => {
      try {
        const share = await acceptClientWorkspaceShareAction({
          token,
          guestAccountId,
        });
        toast.success('Share accepted');
        const slug = share.guestAccountSlug;
        if (slug) {
          router.push(
            pathsConfig.app.accountSharedClients.replace('[account]', slug),
          );
        } else {
          router.push(pathsConfig.app.home);
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not accept share',
        );
      }
    });
  }

  if (loading) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading your workspaces…
      </p>
    );
  }

  if (workspaces.length === 0) {
    return (
      <div className="space-y-3 text-sm">
        <p>
          You need to be an owner or admin of a team workspace to accept this
          share.
        </p>
        <Button asChild variant="outline">
          <a href={pathsConfig.app.home}>Go to home</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {invitedEmail ? (
        <p className="text-muted-foreground text-xs">
          Invited as {invitedEmail}
        </p>
      ) : null}

      <div>
        <p className="mb-2 text-sm font-medium">Access included</p>
        <ul className="flex flex-wrap gap-2">
          {enabled.map((module) => (
            <li
              key={module.key}
              className="rounded-full border px-2.5 py-0.5 text-xs"
            >
              {module.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <Label>Accept into workspace</Label>
        <Select value={guestAccountId} onValueChange={setGuestAccountId}>
          <SelectTrigger>
            <SelectValue placeholder="Select workspace" />
          </SelectTrigger>
          <SelectContent>
            {workspaces.map((workspace) => (
              <SelectItem key={workspace.id} value={workspace.id}>
                {workspace.name} ({workspace.slug})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="button" disabled={pending} onClick={accept}>
        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Accept share
      </Button>
    </div>
  );
}
