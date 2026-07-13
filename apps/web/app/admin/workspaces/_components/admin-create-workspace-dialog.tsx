'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@kit/ui/alert-dialog';
import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
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

import { createAdminWorkspaceAction } from '~/lib/admin/admin-workspace.actions';
import {
  type CreateAdminWorkspaceInput,
  CreateAdminWorkspaceSchema,
} from '~/lib/admin/admin-workspace.schema';

export function AdminCreateWorkspaceDialog(props: React.PropsWithChildren) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const form = useForm<CreateAdminWorkspaceInput>({
    resolver: zodResolver(CreateAdminWorkspaceSchema),
    defaultValues: {
      name: '',
      ownerEmail: '',
      profile: 'work_design',
      businessMode: 'lite',
      billingExempt: true,
    },
  });

  const profile = useWatch({ control: form.control, name: 'profile' });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{props.children}</AlertDialogTrigger>
      <AlertDialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Create workspace</AlertDialogTitle>
          <AlertDialogDescription>
            Create a team workspace for an existing user, optionally with
            billing turned off.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => {
              startTransition(async () => {
                try {
                  const result = await createAdminWorkspaceAction(values);
                  toast.success('Workspace created');
                  setOpen(false);
                  form.reset();
                  router.push(`/admin/workspaces/${result.accountId}`);
                  router.refresh();
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : 'Could not create workspace',
                  );
                }
              });
            })}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Workspace name</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Design" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ownerEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Owner email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="owner@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Must already have an Ozer user account. They become the
                    primary owner.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="profile"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Workspace type</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      if (value !== 'work_design') {
                        form.setValue('businessMode', undefined);
                      } else if (!form.getValues('businessMode')) {
                        form.setValue('businessMode', 'lite');
                      }
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="work_design">Business</SelectItem>
                      <SelectItem value="work_property">Property</SelectItem>
                      <SelectItem value="family">Family</SelectItem>
                      <SelectItem value="community">Community</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {profile === 'work_design' ? (
              <FormField
                control={form.control}
                name="businessMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business mode</FormLabel>
                    <Select
                      value={field.value ?? 'lite'}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="lite">Business Lite</SelectItem>
                        <SelectItem value="full">Full Business CRM</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <FormField
              control={form.control}
              name="billingExempt"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-3 rounded-lg border p-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) =>
                        field.onChange(Boolean(checked))
                      }
                    />
                  </FormControl>
                  <div className="space-y-1">
                    <FormLabel className="font-medium">Billing off</FormLabel>
                    <FormDescription>
                      Mark this workspace billing-exempt so it can be used
                      without a Stripe subscription.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <AlertDialogFooter>
              <AlertDialogCancel type="button" disabled={pending}>
                Cancel
              </AlertDialogCancel>
              <Button type="submit" disabled={pending}>
                {pending ? 'Creating…' : 'Create workspace'}
              </Button>
            </AlertDialogFooter>
          </form>
        </Form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
