'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';

import { ShieldCheck, UserPlus } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@kit/ui/alert-dialog';
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
import { toast } from '@kit/ui/sonner';

import {
  createProjectGuestInviteAction,
  listProjectGuestsAction,
  revokeProjectGuestAction,
  updateProjectGuestPermissionsAction,
} from '~/lib/projects/project-guests-actions';
import type {
  ProjectGuest,
  ProjectGuestPermissions,
} from '~/lib/projects/project-guests.types';

const DEFAULT_PERMISSIONS: ProjectGuestPermissions = {
  comment: true,
  create_task: true,
  edit_own_task: true,
  edit_all_tasks: false,
  edit_canvas: false,
};

const PERMISSION_OPTIONS: Array<{
  key: keyof ProjectGuestPermissions;
  label: string;
  summary: string;
  hint: string;
}> = [
  {
    key: 'comment',
    label: 'Comment',
    summary: 'comment',
    hint: 'On tasks and canvas cards',
  },
  {
    key: 'create_task',
    label: 'Create tasks',
    summary: 'create tasks',
    hint: 'Add tasks to the project',
  },
  {
    key: 'edit_own_task',
    label: 'Edit own tasks',
    summary: 'edit own tasks',
    hint: 'Only tasks they created',
  },
  {
    key: 'edit_all_tasks',
    label: 'Edit all tasks',
    summary: 'edit all tasks',
    hint: 'Change any task in this project',
  },
  {
    key: 'edit_canvas',
    label: 'Edit the canvas',
    summary: 'edit the canvas',
    hint: 'Add and change notes, text, drawings, images and files',
  },
];

function summarisePermissions(permissions: ProjectGuestPermissions) {
  const granted = PERMISSION_OPTIONS.filter((option) => {
    if (option.key === 'edit_own_task' && permissions.edit_all_tasks) {
      return false;
    }
    return permissions[option.key];
  }).map((option) => option.summary);
  return granted.length > 0 ? `Can ${granted.join(', ')}` : 'View only';
}

function PermissionChecklist({
  value,
  onChange,
}: {
  value: ProjectGuestPermissions;
  onChange: (next: ProjectGuestPermissions) => void;
}) {
  const handleChange = (
    key: keyof ProjectGuestPermissions,
    checked: boolean,
  ) => {
    const next = { ...value, [key]: checked };
    if (key === 'edit_all_tasks' && checked) {
      next.edit_own_task = true;
    } else if (key === 'edit_own_task' && !checked) {
      next.edit_all_tasks = false;
    }
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-[var(--workspace-shell-text-muted)]">
        Permissions
      </p>
      {PERMISSION_OPTIONS.map(({ key, label, hint }) => (
        <label
          key={key}
          className="flex items-start gap-2 text-sm text-[var(--workspace-shell-text)]"
        >
          <Checkbox
            className="mt-0.5"
            checked={value[key]}
            onCheckedChange={(checked) => handleChange(key, checked === true)}
          />
          <span>
            {label}
            <span className="block text-xs text-[var(--workspace-shell-text-muted)]">
              {hint}
            </span>
          </span>
        </label>
      ))}
      <p className="text-xs text-[var(--workspace-shell-text-muted)]">
        Guests can always view the board and canvas. They never see clients,
        contacts or finances.
      </p>
    </div>
  );
}

function statusPillClass(status: ProjectGuest['status']) {
  switch (status) {
    case 'accepted':
      return 'bg-[color:var(--ozer-accent)]/15 text-[color:var(--ozer-accent)]';
    case 'pending':
      return 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]';
    case 'revoked':
      return 'bg-red-500/10 text-red-600 dark:text-red-400';
  }
}

export function ProjectGuestsPanel(props: {
  accountId: string;
  accountSlug: string;
  projectId: string;
  canManage: boolean;
  /** Already-loaded guests, so the panel does not fetch them again. */
  initialGuests?: ProjectGuest[] | null;
}) {
  const [guests, setGuests] = useState<ProjectGuest[]>(
    props.initialGuests ?? [],
  );
  const [loading, setLoading] = useState(!props.initialGuests);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [permissions, setPermissions] =
    useState<ProjectGuestPermissions>(DEFAULT_PERMISSIONS);
  const [revokeTarget, setRevokeTarget] = useState<ProjectGuest | null>(null);
  const [editTarget, setEditTarget] = useState<ProjectGuest | null>(null);
  const [editPermissions, setEditPermissions] =
    useState<ProjectGuestPermissions>(DEFAULT_PERMISSIONS);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listProjectGuestsAction({
        accountId: props.accountId,
        projectId: props.projectId,
      });
      setGuests(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load guests');
      setGuests([]);
    } finally {
      setLoading(false);
    }
  }, [props.accountId, props.projectId]);

  const hadInitial = Boolean(props.initialGuests);
  useEffect(() => {
    if (hadInitial) return;
    void refresh();
  }, [refresh, hadInitial]);

  const visible = guests.filter((g) => g.status !== 'revoked');

  return (
    <div className="space-y-4 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Guests
          </h3>
          <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
            External collaborators for this project only — not full team
            members.
          </p>
        </div>
        {props.canManage ? (
          <Button
            size="sm"
            variant="outline"
            className="border-[color:var(--workspace-shell-border)]"
            onClick={() => {
              setEmail('');
              setPermissions(DEFAULT_PERMISSIONS);
              setInviteOpen(true);
            }}
          >
            <UserPlus className="mr-1.5 h-3.5 w-3.5" />
            Invite guest
          </Button>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          Loading guests…
        </p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          No guests yet. Invite someone to view, comment on and (if you allow
          it) edit this project.
        </p>
      ) : (
        <ul className="divide-y divide-[color:var(--workspace-shell-border)]">
          {visible.map((guest) => (
            <li
              key={guest.id}
              className="flex flex-wrap items-center justify-between gap-2 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                  {guest.invitedEmail}
                </p>
                <span
                  className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ${statusPillClass(guest.status)}`}
                >
                  {guest.status}
                </span>
                <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
                  {summarisePermissions(guest.permissions)}
                </p>
              </div>
              {props.canManage && guest.status !== 'revoked' ? (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditPermissions(guest.permissions);
                      setEditTarget(guest);
                    }}
                  >
                    <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                    Permissions
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => setRevokeTarget(guest)}
                  >
                    Revoke
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite project guest</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="guest-email">Email</Label>
              <Input
                id="guest-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="guest@example.com"
                className="mt-1 border-[color:var(--workspace-shell-border)]"
              />
            </div>
            <PermissionChecklist
              value={permissions}
              onChange={setPermissions}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={pending || !email.trim()}
              onClick={() => {
                startTransition(async () => {
                  try {
                    await createProjectGuestInviteAction({
                      accountId: props.accountId,
                      accountSlug: props.accountSlug,
                      projectId: props.projectId,
                      email: email.trim(),
                      permissions,
                    }).then(async (result) => {
                      if (result.emailSent) {
                        toast.success('Invite sent');
                        return;
                      }

                      const message =
                        result.emailError ??
                        'Invite created, but the email could not be sent';

                      try {
                        await navigator.clipboard.writeText(result.acceptUrl);
                        toast.error(
                          `${message} Invite link copied to clipboard.`,
                        );
                      } catch {
                        toast.error(
                          `${message} Share this link: ${result.acceptUrl}`,
                        );
                      }
                    });
                    setInviteOpen(false);
                    await refresh();
                  } catch (e) {
                    toast.error(
                      e instanceof Error ? e.message : 'Failed to send invite',
                    );
                  }
                });
              }}
            >
              {pending ? 'Sending…' : 'Send invite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editTarget)}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
      >
        <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Guest permissions</DialogTitle>
            <p className="truncate text-sm text-[var(--workspace-shell-text-muted)]">
              {editTarget?.invitedEmail}
            </p>
          </DialogHeader>
          <PermissionChecklist
            value={editPermissions}
            onChange={setEditPermissions}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={
                pending || !Object.values(editPermissions).some(Boolean)
              }
              onClick={() => {
                if (!editTarget) return;
                startTransition(async () => {
                  try {
                    const result = await updateProjectGuestPermissionsAction({
                      accountId: props.accountId,
                      accountSlug: props.accountSlug,
                      projectId: props.projectId,
                      guestId: editTarget.id,
                      permissions: editPermissions,
                    });
                    setGuests((prev) =>
                      prev.map((guest) =>
                        guest.id === editTarget.id
                          ? { ...guest, permissions: result.permissions }
                          : guest,
                      ),
                    );
                    toast.success('Permissions updated');
                    setEditTarget(null);
                  } catch (e) {
                    toast.error(
                      e instanceof Error
                        ? e.message
                        : 'Failed to update permissions',
                    );
                  }
                });
              }}
            >
              {pending ? 'Saving…' : 'Save permissions'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
      >
        <AlertDialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke guest access?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget?.invitedEmail} will lose access to this project. You
              can invite them again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (!revokeTarget) return;
                startTransition(async () => {
                  try {
                    await revokeProjectGuestAction({
                      accountId: props.accountId,
                      accountSlug: props.accountSlug,
                      projectId: props.projectId,
                      guestId: revokeTarget.id,
                    });
                    toast.success('Access revoked');
                    setRevokeTarget(null);
                    await refresh();
                  } catch (e) {
                    toast.error(
                      e instanceof Error ? e.message : 'Failed to revoke',
                    );
                  }
                });
              }}
            >
              Revoke access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
