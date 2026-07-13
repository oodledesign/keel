'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

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
  id: number;
  email: string;
  role: string;
  createdAt: string;
};

export function AdminWorkspaceMembersPanel(props: {
  accountId: string;
  members: AdminWorkspaceMember[];
  invitations: AdminWorkspaceInvitation[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
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
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Pending invitations</h3>
          </div>
          <ul className="divide-y">
            {props.invitations.map((invite) => (
              <li
                key={invite.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{invite.email}</p>
                  <p className="text-muted-foreground text-xs">
                    Invited as {invite.role} ·{' '}
                    {new Date(invite.createdAt).toLocaleDateString('en-GB')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
