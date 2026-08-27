'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { type Resolver, useForm } from 'react-hook-form';

import { AdminImpersonateUserDialog } from '@kit/admin/components/admin-impersonate-user-dialog';
import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@kit/ui/form';
import { Input } from '@kit/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';

import type { SeatUsageSummaryProps } from '~/home/[account]/members/_components/seat-usage-summary';
import { SeatUsageSummary } from '~/home/[account]/members/_components/seat-usage-summary';
import {
  addAdminWorkspaceMemberAction,
  deleteAdminWorkspaceInviteAction,
  removeAdminWorkspaceMemberAction,
  resendAdminWorkspaceInviteAction,
  resendAllAdminWorkspaceInvitesAction,
  updateAdminWorkspaceMemberRoleAction,
} from '~/lib/admin/admin-workspace.actions';
import {
  ADMIN_WORKSPACE_ROLES,
  type AddAdminWorkspaceMemberInput,
  AddAdminWorkspaceMemberSchema,
  type AdminWorkspaceRole,
} from '~/lib/admin/admin-workspace.schema';

export type AdminWorkspaceMember = {
  userId: string;
  name: string | null;
  email: string | null;
  role: string;
  seatKind: 'billable' | 'support' | 'platform';
  isPrimaryOwner: boolean;
};

export type AdminWorkspaceInvitation = {
  id: string;
  /** Numeric invitations.id for workspace member invites (null for project guests). */
  invitationId: number | null;
  email: string;
  role: string;
  seatKind: 'billable' | 'support' | 'platform' | null;
  kind: 'member' | 'project_guest';
  status: 'pending';
  createdAt: string;
  projectName: string | null;
};

const COMMERCIAL_ADMIN_ROLES = ['owner', 'admin', 'staff'] as const;

export function AdminWorkspaceMembersPanel(props: {
  accountId: string;
  isCommercial: boolean;
  members: AdminWorkspaceMember[];
  invitations: AdminWorkspaceInvitation[];
  seatUsage: SeatUsageSummaryProps | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [resendPending, startResendTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();
  const [resendPendingId, setResendPendingId] = useState<number | null>(null);
  const [deletePendingId, setDeletePendingId] = useState<number | null>(null);
  const [rolePendingUserId, setRolePendingUserId] = useState<string | null>(
    null,
  );

  const roles = props.isCommercial
    ? COMMERCIAL_ADMIN_ROLES
    : ADMIN_WORKSPACE_ROLES;

  const form = useForm<AddAdminWorkspaceMemberInput>({
    resolver: zodResolver(
      AddAdminWorkspaceMemberSchema,
    ) as unknown as Resolver<AddAdminWorkspaceMemberInput>,
    defaultValues: {
      accountId: props.accountId,
      email: '',
      role: 'staff',
      seatKind: 'billable',
    },
  });

  return (
    <div className="space-y-6">
      {props.seatUsage ? <SeatUsageSummary {...props.seatUsage} /> : null}

      <div className="rounded-lg border p-4">
        <h3 className="mb-3 text-sm font-semibold">Add or invite member</h3>
        <p className="text-muted-foreground mb-3 text-xs">
          Super-admin users are added with a free platform seat and do not count
          toward billing.
        </p>
        <Form {...form}>
          <form
            className={
              props.isCommercial
                ? 'grid gap-3 sm:grid-cols-[1fr_8rem_9rem_auto]'
                : 'grid gap-3 sm:grid-cols-[1fr_10rem_auto]'
            }
            onSubmit={form.handleSubmit((values) => {
              startTransition(async () => {
                try {
                  const result = await addAdminWorkspaceMemberAction(values);
                  toast.success(
                    result.mode === 'added'
                      ? 'Member added'
                      : 'Invitation sent',
                  );
                  form.reset({
                    accountId: props.accountId,
                    email: '',
                    role: 'staff',
                    seatKind: 'billable',
                  });
                  router.refresh();
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : 'Could not add member',
                  );
                }
              });
            })}
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="colleague@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Role</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {props.isCommercial ? (
              <FormField
                control={form.control}
                name="seatKind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="sr-only">Seat</FormLabel>
                    <Select
                      value={field.value ?? 'billable'}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seat" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="billable">Billable seat</SelectItem>
                        <SelectItem value="support">Support seat</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Add / invite'}
            </Button>
          </form>
        </Form>
        <p className="text-muted-foreground mt-2 text-xs">
          Existing users are added immediately. New emails get a workspace
          invitation.
          {props.isCommercial
            ? ' Role controls permissions; seat kind controls billing and commercial edit rights.'
            : null}
        </p>
      </div>

      <div className="rounded-lg border">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Members</h3>
        </div>
        <ul className="divide-y">
          {props.members.length === 0 ? (
            <li className="text-muted-foreground px-4 py-6 text-sm">
              No members yet.
            </li>
          ) : (
            props.members.map((member) => (
              <li
                key={member.userId}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {member.name || member.email || member.userId}
                    {member.isPrimaryOwner ? (
                      <span className="text-muted-foreground ml-2 text-xs">
                        Primary owner
                      </span>
                    ) : null}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {member.email}
                  </p>
                  {props.isCommercial ? (
                    <Badge variant="outline" className="mt-1 capitalize">
                      {member.seatKind === 'platform'
                        ? 'Platform admin'
                        : `${member.seatKind} seat`}
                    </Badge>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <AdminImpersonateUserDialog
                    userId={member.userId}
                    reason={`Workspace member support (${props.accountId})`}
                  >
                    <Button type="button" variant="secondary" size="sm">
                      Impersonate
                    </Button>
                  </AdminImpersonateUserDialog>
                  <Select
                    value={member.role}
                    disabled={
                      member.isPrimaryOwner ||
                      rolePendingUserId === member.userId
                    }
                    onValueChange={(role) => {
                      setRolePendingUserId(member.userId);
                      startTransition(async () => {
                        try {
                          await updateAdminWorkspaceMemberRoleAction({
                            accountId: props.accountId,
                            userId: member.userId,
                            role: role as AdminWorkspaceRole,
                          });
                          toast.success('Role updated');
                          router.refresh();
                        } catch (error) {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : 'Could not update role',
                          );
                        } finally {
                          setRolePendingUserId(null);
                        }
                      });
                    }}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!member.isPrimaryOwner ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => {
                        startTransition(async () => {
                          try {
                            await removeAdminWorkspaceMemberAction({
                              accountId: props.accountId,
                              userId: member.userId,
                            });
                            toast.success('Member removed');
                            router.refresh();
                          } catch (error) {
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : 'Could not remove member',
                            );
                          }
                        });
                      }}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {props.invitations.length > 0 ? (
        <div className="rounded-lg border">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold">Pending invitations</h3>
              <p className="text-muted-foreground text-xs">
                Resend or delete workspace invites (resend extends expiry by 7
                days)
              </p>
            </div>
            {props.invitations.some((invite) => invite.invitationId != null) ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={resendPending || deletePending}
                onClick={() => {
                  startResendTransition(async () => {
                    try {
                      const result = await resendAllAdminWorkspaceInvitesAction(
                        {
                          accountId: props.accountId,
                        },
                      );
                      toast.success(
                        result.failed > 0
                          ? `Sent ${result.sent}, failed ${result.failed}`
                          : `Sent ${result.sent} invite${result.sent === 1 ? '' : 's'}`,
                      );
                      router.refresh();
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : 'Could not send invites',
                      );
                    }
                  });
                }}
              >
                {resendPending ? 'Sending…' : 'Send all invite emails'}
              </Button>
            ) : null}
          </div>
          <ul className="divide-y">
            {props.invitations.map((invite) => (
              <li
                key={invite.id}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">
                      {invite.email}
                    </p>
                    <Badge variant="outline">Pending</Badge>
                    {invite.kind === 'project_guest' ? (
                      <Badge variant="secondary">Project guest</Badge>
                    ) : null}
                    {props.isCommercial && invite.seatKind ? (
                      <Badge variant="secondary" className="capitalize">
                        {invite.seatKind} seat
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {invite.kind === 'project_guest'
                      ? invite.projectName
                        ? `Guest invite · ${invite.projectName}`
                        : 'Guest invite'
                      : `Invited as ${invite.role}`}{' '}
                    · {new Date(invite.createdAt).toLocaleDateString('en-GB')}
                  </p>
                </div>
                {invite.invitationId != null ? (
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={
                        resendPending ||
                        deletePending ||
                        resendPendingId === invite.invitationId ||
                        deletePendingId === invite.invitationId
                      }
                      onClick={() => {
                        const invitationId = invite.invitationId;
                        if (invitationId == null) return;

                        setResendPendingId(invitationId);
                        startResendTransition(async () => {
                          try {
                            await resendAdminWorkspaceInviteAction({
                              accountId: props.accountId,
                              invitationId,
                            });
                            toast.success(`Invite sent to ${invite.email}`);
                            router.refresh();
                          } catch (error) {
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : 'Could not send invite',
                            );
                          } finally {
                            setResendPendingId(null);
                          }
                        });
                      }}
                    >
                      {resendPendingId === invite.invitationId
                        ? 'Sending…'
                        : 'Resend email'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={
                        resendPending ||
                        deletePending ||
                        resendPendingId === invite.invitationId ||
                        deletePendingId === invite.invitationId
                      }
                      onClick={() => {
                        const invitationId = invite.invitationId;
                        if (invitationId == null) return;

                        setDeletePendingId(invitationId);
                        startDeleteTransition(async () => {
                          try {
                            await deleteAdminWorkspaceInviteAction({
                              accountId: props.accountId,
                              invitationId,
                            });
                            toast.success(`Invite deleted for ${invite.email}`);
                            router.refresh();
                          } catch (error) {
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : 'Could not delete invite',
                            );
                          } finally {
                            setDeletePendingId(null);
                          }
                        });
                      }}
                    >
                      {deletePendingId === invite.invitationId
                        ? 'Deleting…'
                        : 'Delete'}
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
