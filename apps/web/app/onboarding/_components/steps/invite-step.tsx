'use client';

import Link from 'next/link';

import { useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Plus, X } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';

import { createInvitationsAction } from '@kit/team-accounts/server-actions';
import { Button } from '@kit/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
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

import pathsConfig from '~/config/paths.config';

import { completeOnboarding } from '../../_lib/server/onboarding.actions';
import { PrimaryButton } from '../primary-button';

const inviteRowSchema = z.object({
  email: z.string().email('Enter a valid email'),
  role: z.enum(['staff', 'admin', 'contractor']),
});

const inviteFormSchema = z.object({
  invitations: z
    .array(inviteRowSchema)
    .min(1)
    .max(5)
    .refine(
      (arr) => {
        const emails = arr.map((r) => r.email.toLowerCase());
        return new Set(emails).size === emails.length;
      },
      { message: 'Duplicate emails are not allowed' },
    ),
});

type InviteFormValues = z.infer<typeof inviteFormSchema>;

interface InviteStepProps {
  accountId: string;
  accountSlug: string;
}

const DEFAULT_ROLE = 'staff' as const;
const MAX_INVITES = 5;

export function InviteStep({
  accountId,
  accountSlug,
}: InviteStepProps) {
  const [pending, startTransition] = useTransition();
  const [sentCount, setSentCount] = useState<number | null>(null);
  const membersPath = pathsConfig.app.accountMembers.replace(
    '[account]',
    accountSlug,
  );

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: {
      invitations: [{ email: '', role: DEFAULT_ROLE }],
    },
  });

  const fieldArray = useFieldArray({
    control: form.control,
    name: 'invitations',
  });

  const onSubmit = (data: InviteFormValues) => {
    startTransition(async () => {
      const result = await createInvitationsAction({
        accountSlug,
        invitations: data.invitations.map((i) => ({
          email: i.email.trim(),
          role: i.role,
        })),
      });

      if (result.success) {
        setSentCount(data.invitations.length);
        toast.success(
          data.invitations.length === 1
            ? 'Invitation sent'
            : `${data.invitations.length} invitations sent`,
        );
        form.reset({
          invitations: [{ email: '', role: DEFAULT_ROLE }],
        });
      } else {
        const message =
          result.reasons?.length && result.reasons[0]
            ? result.reasons[0]
            : 'Failed to send invitations';
        toast.error(message);
      }
    });
  };

  const handleFinish = async () => {
    await completeOnboarding(accountId);
    window.location.href = `/home/${accountSlug}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">
          Invite your team
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Send invitations by email. You can also invite more people later from
          Members.
        </p>
      </div>

      <Form {...form}>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <div className="space-y-3">
            {fieldArray.fields.map((field, index) => (
              <div
                key={field.id}
                className="flex items-end gap-2 rounded-lg border border-zinc-700 bg-zinc-900/50 p-3"
              >
                <div className="flex-1 space-y-2">
                  <FormField
                    control={form.control}
                    name={`invitations.${index}.email`}
                    render={({ field: f }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                            <Input
                              type="email"
                              placeholder="colleague@company.com"
                              className="border-zinc-600 bg-zinc-800/80 pl-9 text-white placeholder:text-zinc-500"
                              {...f}
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-amber-400" />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name={`invitations.${index}.role`}
                  render={({ field: f }) => (
                    <FormItem className="w-[120px]">
                      <Select
                        value={f.value}
                        onValueChange={f.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="border-zinc-600 bg-zinc-800/80 text-white">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-zinc-400 hover:text-white"
                  disabled={fieldArray.fields.length <= 1}
                  onClick={() => fieldArray.remove(index)}
                  aria-label="Remove invite"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {fieldArray.fields.length < MAX_INVITES && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="text-emerald-400 hover:text-emerald-300"
                disabled={pending}
                onClick={() =>
                  fieldArray.append({ email: '', role: DEFAULT_ROLE })
                }
              >
                <Plus className="mr-1 h-4 w-4" />
                Add another
              </Button>
            )}
          </div>

          <PrimaryButton
            type="submit"
            disabled={pending || !form.watch('invitations').some((i) => i.email.trim())}
          >
            {pending ? 'Sending…' : 'Send invitations'}
          </PrimaryButton>
        </form>
      </Form>

      {sentCount !== null && (
        <p className="text-sm text-emerald-400">
          {sentCount === 1 ? '1 invitation sent.' : `${sentCount} invitations sent.`}{' '}
          You can send more above or later from Members.
        </p>
      )}

      <div className="flex flex-col gap-3 border-t border-zinc-700 pt-6">
        <Button
          variant="outline"
          asChild
          className="w-full border-zinc-600 text-zinc-300 hover:bg-zinc-800"
        >
          <Link href={membersPath}>Invite more from Members</Link>
        </Button>
        <PrimaryButton onClick={handleFinish}>
          Finish onboarding
        </PrimaryButton>
      </div>
    </div>
  );
}
