'use client';

import { useMemo, useState, useTransition } from 'react';

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
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';

import { createAdminUserInviteAction } from '~/lib/admin/user-invites.actions';
import {
  ADMIN_INVITE_ADDON_OPTIONS,
  ADMIN_INVITE_LANDING_MODULES,
  ADMIN_INVITE_WORKSPACE_PROFILES,
  type CreateAdminUserInviteInput,
  CreateAdminUserInviteSchema,
  DEFAULT_WORKSPACE_NAMES,
} from '~/lib/admin/user-invites.schema';

const WORKSPACE_OPTIONS: Array<{
  profile: (typeof ADMIN_INVITE_WORKSPACE_PROFILES)[number];
  label: string;
  businessMode?: 'lite' | 'full';
}> = [
  { profile: 'work_design', label: 'Business Lite', businessMode: 'lite' },
  {
    profile: 'work_design',
    label: 'Business (full CRM)',
    businessMode: 'full',
  },
  { profile: 'work_property', label: 'Property' },
  { profile: 'family', label: 'Family' },
  { profile: 'community', label: 'Community' },
];

type WorkspaceKey = string;

function workspaceKey(
  option: (typeof WORKSPACE_OPTIONS)[number],
): WorkspaceKey {
  return `${option.profile}:${option.businessMode ?? 'default'}`;
}

export function AdminInviteUserDialog(props: React.PropsWithChildren) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [selectedWorkspaceKeys, setSelectedWorkspaceKeys] = useState<
    Set<WorkspaceKey>
  >(() => new Set([workspaceKey(WORKSPACE_OPTIONS[0]!)]));

  const form = useForm<CreateAdminUserInviteInput>({
    resolver: zodResolver(CreateAdminUserInviteSchema),
    defaultValues: {
      email: '',
      inviteeName: '',
      personalOnly: false,
      billingExempt: true,
      personalAddons: [],
      workspaces: [
        {
          profile: 'work_design',
          name: DEFAULT_WORKSPACE_NAMES.work_design,
          businessMode: 'lite',
        },
      ],
      addons: [],
      landingModule: 'signatures',
    },
  });

  const personalOnly = useWatch({
    control: form.control,
    name: 'personalOnly',
  });
  const selectedAddons = useWatch({ control: form.control, name: 'addons' });

  const workspaceNames = useWatch({
    control: form.control,
    name: 'workspaces',
  });

  const syncWorkspacesFromSelection = (keys: Set<WorkspaceKey>) => {
    const workspaces = WORKSPACE_OPTIONS.filter((option) =>
      keys.has(workspaceKey(option)),
    ).map((option) => ({
      profile: option.profile,
      name:
        workspaceNames?.find(
          (ws) =>
            ws.profile === option.profile &&
            (option.businessMode
              ? ws.businessMode === option.businessMode
              : !ws.businessMode || ws.businessMode === 'lite'),
        )?.name ?? DEFAULT_WORKSPACE_NAMES[option.profile],
      businessMode: option.businessMode,
    }));

    form.setValue('workspaces', workspaces, { shouldValidate: true });
  };

  const toggleWorkspace = (key: WorkspaceKey, checked: boolean) => {
    const next = new Set(selectedWorkspaceKeys);

    if (checked) {
      next.add(key);
    } else {
      next.delete(key);
    }

    setSelectedWorkspaceKeys(next);
    syncWorkspacesFromSelection(next);
  };

  const toggleAddon = (key: CreateAdminUserInviteInput['addons'][number]) => {
    const current = form.getValues('addons');
    const exists = current.includes(key);
    form.setValue(
      'addons',
      exists ? current.filter((item) => item !== key) : [...current, key],
      { shouldValidate: true },
    );
  };

  const showLandingModule = useMemo(() => {
    return (
      !personalOnly &&
      WORKSPACE_OPTIONS.some(
        (option) =>
          option.profile === 'work_design' &&
          selectedWorkspaceKeys.has(workspaceKey(option)),
      )
    );
  }, [personalOnly, selectedWorkspaceKeys]);

  const onSubmit = (data: CreateAdminUserInviteInput) => {
    startTransition(async () => {
      try {
        const result = await createAdminUserInviteAction(data);

        if (!result.success) {
          toast.error(result.error);
          return;
        }

        toast.success(`Invitation sent to ${data.email}`);
        form.reset();
        setSelectedWorkspaceKeys(
          new Set([workspaceKey(WORKSPACE_OPTIONS[0]!)]),
        );
        setOpen(false);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to send invitation',
        );
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{props.children}</AlertDialogTrigger>

      <AlertDialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Invite user</AlertDialogTitle>
          <AlertDialogDescription>
            Send an email invitation with access configured before they sign in.
            Workspaces and add-ons are created automatically on acceptance. If
            SES is still in sandbox mode, verify both the sender and the invitee
            email in Amazon SES, or request production access.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Form {...form}>
          <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="amie@thistleleaf.com"
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="inviteeName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Aimee" autoComplete="off" />
                  </FormControl>
                  <FormDescription>
                    Used in the invite email greeting — e.g. “Hi Aimee,”.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="personalOnly"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-3 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        const value = checked === true;
                        field.onChange(value);
                        if (value) {
                          setSelectedWorkspaceKeys(new Set());
                          form.setValue('workspaces', []);
                          form.setValue('addons', []);
                        } else {
                          form.setValue('personalAddons', []);
                          const defaultKey = workspaceKey(
                            WORKSPACE_OPTIONS[0]!,
                          );
                          const next = new Set<WorkspaceKey>([defaultKey]);
                          setSelectedWorkspaceKeys(next);
                          syncWorkspacesFromSelection(next);
                        }
                      }}
                    />
                  </FormControl>
                  <div className="space-y-1">
                    <FormLabel>Personal only</FormLabel>
                    <FormDescription>
                      Free personal account — optionally grant personal add-ons
                      below.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {personalOnly ? (
              <div className="space-y-3">
                <Label>Personal add-ons</Label>
                <div className="rounded-md border p-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form
                        .watch('personalAddons')
                        ?.includes('addon_email_assistant')}
                      onCheckedChange={(checked) => {
                        const current = form.getValues('personalAddons') ?? [];
                        form.setValue(
                          'personalAddons',
                          checked
                            ? [
                                ...new Set([
                                  ...current,
                                  'addon_email_assistant' as const,
                                ]),
                              ]
                            : current.filter(
                                (key) => key !== 'addon_email_assistant',
                              ),
                          { shouldValidate: true },
                        );
                      }}
                    />
                    Email Assistant
                  </label>
                </div>
              </div>
            ) : null}

            {!personalOnly ? (
              <>
                <div className="space-y-3">
                  <Label>Workspace access</Label>
                  <div className="space-y-2 rounded-md border p-3">
                    {WORKSPACE_OPTIONS.map((option) => {
                      const key = workspaceKey(option);
                      const checked = selectedWorkspaceKeys.has(key);

                      return (
                        <div key={key} className="space-y-2">
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) =>
                                toggleWorkspace(key, value === true)
                              }
                            />
                            {option.label}
                          </label>

                          {checked ? (
                            <Input
                              value={
                                workspaceNames?.find(
                                  (ws) =>
                                    ws.profile === option.profile &&
                                    ws.businessMode === option.businessMode,
                                )?.name ??
                                DEFAULT_WORKSPACE_NAMES[option.profile]
                              }
                              onChange={(event) => {
                                const workspaces = form.getValues('workspaces');
                                form.setValue(
                                  'workspaces',
                                  workspaces.map((ws) =>
                                    ws.profile === option.profile &&
                                    ws.businessMode === option.businessMode
                                      ? { ...ws, name: event.target.value }
                                      : ws,
                                  ),
                                  { shouldValidate: true },
                                );
                              }}
                              placeholder="Workspace name"
                              className="ml-6 max-w-sm"
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  <FormMessage>
                    {form.formState.errors.workspaces?.message}
                  </FormMessage>
                </div>

                <div className="space-y-3">
                  <Label>Add-ons</Label>
                  <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
                    {ADMIN_INVITE_ADDON_OPTIONS.map((addon) => (
                      <label
                        key={addon.key}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={selectedAddons?.includes(addon.key) ?? false}
                          onCheckedChange={() => toggleAddon(addon.key)}
                        />
                        {addon.label}
                      </label>
                    ))}
                  </div>
                  <FormMessage>
                    {form.formState.errors.addons?.message}
                  </FormMessage>
                </div>

                {showLandingModule ? (
                  <FormField
                    control={form.control}
                    name="landingModule"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Land them on</FormLabel>
                        <Select
                          value={field.value ?? 'dashboard'}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose destination" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ADMIN_INVITE_LANDING_MODULES.map((item) => (
                              <SelectItem key={item.key} value={item.key}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Opens this page right after they accept the invite.
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                ) : null}
              </>
            ) : null}

            <FormField
              control={form.control}
              name="billingExempt"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-3 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={personalOnly}
                    />
                  </FormControl>
                  <div className="space-y-1">
                    <FormLabel>Mark billing exempt</FormLabel>
                    <FormDescription>
                      Skips Stripe checkout for granted workspace and add-on
                      access.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <AlertDialogFooter>
              <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
              <Button disabled={pending} type="submit">
                {pending ? 'Sending…' : 'Send invitation'}
              </Button>
            </AlertDialogFooter>
          </form>
        </Form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
