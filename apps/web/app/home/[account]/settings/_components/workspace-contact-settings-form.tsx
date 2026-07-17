'use client';

import { useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

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
import { toast } from '@kit/ui/sonner';

import { saveWorkspaceContactSettingsSchema } from '../_lib/schema/workspace-contact.schema';
import { saveWorkspaceContactSettings } from '../_lib/server/workspace-contact-actions';

type FormValues = z.infer<typeof saveWorkspaceContactSettingsSchema>;

export type WorkspaceContactSettings = {
  contact_email: string | null;
  phone: string | null;
  website_url: string | null;
};

export function WorkspaceContactSettingsForm({
  accountId,
  initial,
  canEdit,
}: {
  accountId: string;
  initial: WorkspaceContactSettings;
  canEdit: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(saveWorkspaceContactSettingsSchema),
    defaultValues: {
      accountId,
      contact_email: initial.contact_email ?? '',
      phone: initial.phone ?? '',
      website_url: initial.website_url ?? '',
    } satisfies FormValues,
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  const onSubmit = (data: FormValues) => {
    startTransition(async () => {
      try {
        await saveWorkspaceContactSettings({
          ...data,
          contact_email: data.contact_email?.trim() || null,
          phone: data.phone?.trim() || null,
          website_url: data.website_url?.trim() || null,
        });
        toast.success('Business contact saved');
      } catch {
        toast.error('Failed to save contact details. Please try again.');
      }
    });
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-6 shadow-[0_18px_50px_rgba(4,10,24,0.24)]">
      <div>
        <h2 className="text-base font-semibold">Business contact</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Shown on invoices and other client-facing documents.
        </p>
      </div>

      {!canEdit ? (
        <p className="text-muted-foreground rounded-xl border border-[color:var(--workspace-shell-border)] bg-black/10 px-4 py-3 text-sm">
          Only workspace owners and admins can edit business contact details.
        </p>
      ) : null}

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-5"
          data-test="workspace-contact-form"
        >
          <FormField
            name="contact_email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Business email</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    id="workspace-contact-email"
                    type="email"
                    placeholder="hello@yourcompany.com"
                    disabled={!canEdit}
                    data-test="workspace-contact-email"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    id="workspace-contact-phone"
                    placeholder="+44 20 1234 5678"
                    disabled={!canEdit}
                    data-test="workspace-contact-phone"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="website_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    id="workspace-contact-website"
                    placeholder="www.yourcompany.com"
                    disabled={!canEdit}
                    data-test="workspace-contact-website"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {canEdit ? (
            <Button
              type="submit"
              disabled={isPending}
              data-test="save-contact-details"
            >
              {isPending ? 'Saving...' : 'Save contact details'}
            </Button>
          ) : null}
        </form>
      </Form>
    </div>
  );
}
