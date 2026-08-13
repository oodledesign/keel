'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

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

import {
  addAdminWorkspaceMemberAction,
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
  isPrimaryOwner: boolean;
};

export type AdminWorkspaceInvitation = {
  id: string;
  /** Numeric invitations.id for workspace member invites (null for project guests). */
  invitationId: number | null;
  email: string;
  role: string;
  kind: 'member' | 'project_guest';
  status: 'pending';
  createdAt: string;
  projectName: string | null;
};

export function AdminWorkspaceMembersPanel(props: {
  accountId: string;
  members: AdminWorkspaceMember[];
  invitations: AdminWorkspaceInvitation[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [resendPending, startResendTransition] = useTransition();
  const [rolePendingUserId, setRolePendingUserId] = useState<string | null>(
    null,
  );

  const form = useForm<AddAdminWorkspaceMemberInput>({
    resolver: zodResolver(AddAdminWorkspaceMemberSchema),
    defaultValues: {
      accountId: props.accountId,
      email: '',
      role: 'staff',
    },
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4">
        <h3 className="mb-3 text-sm font-semibold">Add or invite member</h3>
        <Form {...form}>
          <form
            className="grid gap-3 sm:grid-cols-[1fr_10rem_auto]"
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
                      {ADMIN_WORKSPACE_ROLES.map((role) => (
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
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Add / invite'}
            </Button>
          </form>
        </Form>
        <p className="text-muted-foreground mt-2 text-xs">
          Existing users are added immediately. New emails get a workspace
          invitation.
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
                      {ADMIN_WORKSPACE_ROLES.map((role) => (
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
                Resend workspace invite emails (extends expiry by 7 days)
              </p>
            </div>
            {props.invitations.some((invite) => invite.invitationId != null) ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={resendPending}
                onClick={() => {
                  startResendTransition(async () => {
                    try {
                      const result = await resendAllAdminWorkspaceInvitesAction({
                        accountId: props.accountId,
                      });
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
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={resendPending}
                    onClick={() => {
                      const invitationId = invite.invitationId;
                      if (invitationId == null) return;

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
                        }
                      });
                    }}
                  >
                    Resend email
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
