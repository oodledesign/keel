'use client';

import { useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Mail, Plus, X } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@kit/ui/alert';
import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@kit/ui/form';
import { If } from '@kit/ui/if';
import { Input } from '@kit/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@kit/ui/input-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { Spinner } from '@kit/ui/spinner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@kit/ui/tooltip';
import { Trans } from '@kit/ui/trans';
import { cn } from '@kit/ui/utils';

import { InviteMembersSchema } from '../../schema/invite-members.schema';
import { createInvitationsAction } from '../../server/actions/team-invitations-server-actions';
import { InviteOptionsHelp } from './invite-options-help';
import { MembershipRoleSelector } from './membership-role-selector';
import { RolesDataProvider } from './roles-data-provider';

/** Light surface for Select menus portaled out of the invite dialog. */
const INVITE_LIGHT_SELECT_CONTENT_CN =
  'bg-[var(--ozer-white)] text-[var(--ozer-text-on-light)] border-[color:var(--ozer-border-on-light)] [--muted-foreground:var(--ozer-plum-600)] [--accent:var(--ozer-cream-100)] [--accent-foreground:var(--ozer-text-on-light)]';

type InviteModel = ReturnType<typeof createEmptyInviteModel>;

type Role = string;

export type InviteProjectOption = {
  id: string;
  name: string;
};

/**
 * The maximum number of invites that can be sent at once.
 * Useful to avoid spamming the server with too large payloads
 */
const MAX_INVITES = 5;

const NO_PROJECT_VALUE = '__none__';

type SeatUsage = {
  used: number;
  maxMembers: number | null;
  remaining: number | null;
  unlimited: boolean;
  commercial?: {
    billableUsed: number;
    billableMax: number;
    supportUsed: number;
    supportMax: number;
  };
};

export function InviteMembersDialogContainer({
  accountSlug,
  userRoleHierarchy,
  projects = [],
  children,
  defaultOpen = false,
  showSeatKind = false,
}: React.PropsWithChildren<{
  accountSlug: string;
  userRoleHierarchy: number;
  projects?: InviteProjectOption[];
  defaultOpen?: boolean;
  /** Commercial Property: choose billable vs free support seat. */
  showSeatKind?: boolean;
}>) {
  const [pending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { t } = useTranslation('teams');

  // Evaluate policies when dialog is open
  const {
    data: policiesResult,
    isLoading: isLoadingPolicies,
    error: policiesError,
  } = useFetchInvitationsPolicies({ accountSlug, isOpen });

  const seatUsage = policiesResult?.metadata?.seatUsage as
    | SeatUsage
    | undefined;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen} modal>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent
        className={cn(
          'sm:max-w-xl',
          // Keep the invite sheet light even when the workspace shell is dark.
          'border-[color:var(--ozer-border-on-light)] bg-[var(--ozer-white)] text-[var(--ozer-text-on-light)]',
          '[--background:var(--ozer-white)] [--foreground:var(--ozer-text-on-light)]',
          '[--muted-foreground:var(--ozer-plum-600)] [--muted:var(--ozer-cream-100)]',
          '[--border:var(--ozer-border-on-light)] [--input:var(--ozer-plum-alpha-18)]',
          '[--secondary-foreground:var(--ozer-text-on-light)] [--secondary:var(--ozer-cream-100)]',
          '[--popover-foreground:var(--ozer-text-on-light)] [--popover:var(--ozer-white)]',
          '[--accent-foreground:var(--ozer-text-on-light)] [--accent:var(--ozer-cream-100)]',
        )}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            <Trans i18nKey={'teams:inviteMembersHeading'} />
          </DialogTitle>

          <DialogDescription>
            <Trans i18nKey={'teams:inviteMembersDescription'} />
          </DialogDescription>
        </DialogHeader>

        <If condition={isLoadingPolicies}>
          <div className="flex flex-col items-center justify-center gap-y-4 py-8">
            <Spinner className="h-6 w-6" />

            <span className="text-muted-foreground text-sm">
              <Trans i18nKey="teams:checkingPolicies" />
            </span>
          </div>
        </If>

        <If condition={policiesError}>
          <Alert variant="destructive">
            <AlertDescription>
              <Trans
                i18nKey="teams:policyCheckError"
                values={{ error: policiesError?.message }}
              />
            </AlertDescription>
          </Alert>
        </If>

        <If
          condition={
            !isLoadingPolicies &&
            seatUsage &&
            !seatUsage.unlimited &&
            (seatUsage.commercial != null || seatUsage.maxMembers != null)
          }
        >
          <p
            className="text-muted-foreground text-sm"
            data-test="invite-seat-usage"
          >
            {seatUsage?.commercial ? (
              <Trans
                i18nKey="teams:seatUsageCommercialHint"
                values={{
                  billableUsed: seatUsage.commercial.billableUsed,
                  billableMax: seatUsage.commercial.billableMax,
                  supportUsed: seatUsage.commercial.supportUsed,
                  supportMax: seatUsage.commercial.supportMax,
                }}
                defaults="Billable {{billableUsed}} of {{billableMax}} · Support {{supportUsed}} of {{supportMax}} free"
              />
            ) : (
              <Trans
                i18nKey={
                  (seatUsage?.remaining ?? 0) > 0
                    ? 'teams:seatUsageHint'
                    : 'teams:seatUsageAtLimit'
                }
                values={{
                  used: seatUsage?.used,
                  max: seatUsage?.maxMembers,
                  remaining: seatUsage?.remaining,
                }}
              />
            )}
          </p>
        </If>

        <If condition={!isLoadingPolicies && !policiesError}>
          <InviteOptionsHelp showSeatKind={showSeatKind} />
        </If>

        <If
          condition={
            policiesResult &&
            !policiesResult.allowed &&
            (seatUsage?.unlimited ||
              seatUsage == null ||
              (seatUsage.remaining ?? 1) > 0)
          }
        >
          <Alert variant="destructive">
            <AlertDescription>
              <Trans
                i18nKey={policiesResult?.reasons[0]}
                defaults={policiesResult?.reasons[0]}
              />
            </AlertDescription>
          </Alert>
        </If>

        <If condition={policiesResult?.allowed}>
          <RolesDataProvider
            maxRoleHierarchy={userRoleHierarchy}
            excludeRoles={['owner']}
          >
            {(roles) => (
              <InviteMembersForm
                pending={pending}
                roles={roles}
                projects={projects}
                showSeatKind={showSeatKind}
                maxInvites={getMaxInvitesForForm(seatUsage)}
                onSubmit={(data) => {
                  startTransition(async () => {
                    const toastId = toast.loading(t('invitingMembers'));

                    const result = await createInvitationsAction({
                      accountSlug,
                      invitations: data.invitations.map((invite) => ({
                        ...invite,
                        seatKind: invite.seatKind ?? 'billable',
                      })),
                    });

                    if (result.success) {
                      toast.success(t('inviteMembersSuccessMessage'), {
                        id: toastId,
                      });
                    } else {
                      toast.error(t('inviteMembersErrorMessage'), {
                        id: toastId,
                      });
                    }

                    setIsOpen(false);
                  });
                }}
              />
            )}
          </RolesDataProvider>
        </If>
      </DialogContent>
    </Dialog>
  );
}

function getMaxInvitesForForm(seatUsage: SeatUsage | undefined) {
  if (!seatUsage || seatUsage.unlimited || seatUsage.remaining == null) {
    return MAX_INVITES;
  }

  return Math.min(MAX_INVITES, Math.max(0, seatUsage.remaining));
}

function InviteMembersForm({
  onSubmit,
  roles,
  projects,
  pending,
  maxInvites,
  showSeatKind = false,
}: {
  onSubmit: (data: {
    invitations: {
      firstName: string;
      lastName: string;
      email: string;
      role: string;
      projectId?: string | null;
      seatKind?: 'billable' | 'support';
    }[];
  }) => void;
  pending: boolean;
  roles: string[];
  projects: InviteProjectOption[];
  maxInvites: number;
  showSeatKind?: boolean;
}) {
  const { t } = useTranslation('teams');
  const defaultRole = roles.includes('staff') ? 'staff' : (roles[0] ?? 'staff');

  const form = useForm({
    resolver: zodResolver(InviteMembersSchema),
    shouldUseNativeValidation: true,
    reValidateMode: 'onSubmit',
    defaultValues: {
      invitations: [createEmptyInviteModel(defaultRole)],
    },
  });

  const fieldArray = useFieldArray({
    control: form.control,
    name: 'invitations',
  });

  return (
    <Form {...form}>
      <form
        className={'flex flex-col space-y-8'}
        data-test={'invite-members-form'}
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <div className="flex flex-col gap-y-4">
          {fieldArray.fields.map((field, index) => {
            const firstNameInputName =
              `invitations.${index}.firstName` as const;
            const lastNameInputName = `invitations.${index}.lastName` as const;
            const emailInputName = `invitations.${index}.email` as const;
            const roleInputName = `invitations.${index}.role` as const;
            const projectInputName = `invitations.${index}.projectId` as const;
            const seatKindInputName = `invitations.${index}.seatKind` as const;
            const seatKind = form.watch(seatKindInputName) ?? 'billable';

            return (
              <div
                data-test={'invite-member-form-item'}
                key={field.id}
                className={cn(
                  'flex flex-col gap-2.5',
                  index > 0 && 'border-border/60 border-t pt-4',
                )}
              >
                <div className="flex items-start gap-2">
                  <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                    <FormField
                      name={firstNameInputName}
                      render={({ field: nameField }) => (
                        <FormItem className="min-w-0">
                          <FormControl>
                            <Input
                              data-test="invite-first-name-input"
                              placeholder={t('firstNamePlaceholder')}
                              autoComplete="given-name"
                              required
                              {...nameField}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      name={lastNameInputName}
                      render={({ field: nameField }) => (
                        <FormItem className="min-w-0">
                          <FormControl>
                            <Input
                              data-test="invite-last-name-input"
                              placeholder={t('lastNamePlaceholder')}
                              autoComplete="family-name"
                              required
                              {...nameField}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={'ghost'}
                          size={'icon'}
                          type={'button'}
                          className="mt-0.5 shrink-0"
                          disabled={fieldArray.fields.length <= 1}
                          data-test={'remove-invite-button'}
                          aria-label={t('removeInviteButtonLabel')}
                          onClick={() => {
                            fieldArray.remove(index);
                            form.clearErrors([
                              firstNameInputName,
                              lastNameInputName,
                              emailInputName,
                            ]);
                          }}
                        >
                          <X className={'h-4'} />
                        </Button>
                      </TooltipTrigger>

                      <TooltipContent>
                        {t('removeInviteButtonLabel')}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <FormField
                  name={emailInputName}
                  render={({ field: emailField }) => (
                    <FormItem className="w-full min-w-0">
                      <FormControl>
                        <InputGroup className="bg-background w-full">
                          <InputGroupAddon align="inline-start">
                            <Mail className="h-4 w-4" />
                          </InputGroupAddon>
                          <InputGroupInput
                            data-test={'invite-email-input'}
                            placeholder={t('emailPlaceholder')}
                            type="email"
                            autoComplete="email"
                            required
                            {...emailField}
                          />
                        </InputGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div
                  className={cn(
                    'grid gap-2',
                    showSeatKind ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1',
                  )}
                >
                  <FormField
                    name={roleInputName}
                    render={({ field: roleField }) => (
                      <FormItem className="min-w-0">
                        <FormControl>
                          <MembershipRoleSelector
                            triggerClassName="bg-background m-0 w-full capitalize"
                            contentClassName={INVITE_LIGHT_SELECT_CONTENT_CN}
                            roles={roles}
                            value={roleField.value}
                            onChange={(role) => {
                              form.setValue(roleField.name, role);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <If condition={showSeatKind}>
                    <FormField
                      name={seatKindInputName}
                      render={({ field: seatField }) => (
                        <FormItem className="min-w-0">
                          <FormControl>
                            <Select
                              value={seatField.value ?? 'billable'}
                              onValueChange={(value) => {
                                form.setValue(
                                  seatKindInputName,
                                  value as 'billable' | 'support',
                                );
                              }}
                            >
                              <SelectTrigger className="bg-background w-full">
                                <SelectValue placeholder="Seat type">
                                  <Trans
                                    i18nKey={
                                      seatKind === 'support'
                                        ? 'teams:seatKindSupportLabel'
                                        : 'teams:seatKindBillableLabel'
                                    }
                                  />
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent
                                className={cn(
                                  'min-w-[16rem]',
                                  INVITE_LIGHT_SELECT_CONTENT_CN,
                                )}
                              >
                                <SelectItem
                                  value="billable"
                                  textValue="Billable"
                                >
                                  <div className="flex flex-col items-start gap-0.5 py-0.5 text-left">
                                    <span>
                                      <Trans i18nKey="teams:seatKindBillableLabel" />
                                    </span>
                                    <span className="text-muted-foreground text-xs font-normal whitespace-normal">
                                      <Trans i18nKey="teams:seatKindBillableDescription" />
                                    </span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="support" textValue="Support">
                                  <div className="flex flex-col items-start gap-0.5 py-0.5 text-left">
                                    <span>
                                      <Trans i18nKey="teams:seatKindSupportLabel" />
                                    </span>
                                    <span className="text-muted-foreground text-xs font-normal whitespace-normal">
                                      <Trans i18nKey="teams:seatKindSupportDescription" />
                                    </span>
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </If>
                </div>

                <If condition={projects.length > 0}>
                  <FormField
                    name={projectInputName}
                    render={({ field: projectField }) => (
                      <FormItem>
                        <FormControl>
                          <Select
                            value={projectField.value ?? NO_PROJECT_VALUE}
                            onValueChange={(value) => {
                              form.setValue(
                                projectInputName,
                                value === NO_PROJECT_VALUE ? null : value,
                              );
                            }}
                          >
                            <SelectTrigger
                              className="bg-background w-full"
                              data-test="invite-project-selector"
                            >
                              <SelectValue
                                placeholder={t('inviteProjectPlaceholder')}
                              />
                            </SelectTrigger>

                            <SelectContent
                              className={INVITE_LIGHT_SELECT_CONTENT_CN}
                            >
                              <SelectItem value={NO_PROJECT_VALUE}>
                                <Trans i18nKey="teams:inviteProjectNone" />
                              </SelectItem>

                              {projects.map((project) => (
                                <SelectItem key={project.id} value={project.id}>
                                  {project.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </If>
              </div>
            );
          })}

          <If condition={fieldArray.fields.length < maxInvites}>
            <div>
              <Button
                data-test={'add-new-invite-button'}
                type={'button'}
                variant={'link'}
                size={'sm'}
                disabled={pending}
                onClick={() => {
                  fieldArray.append(createEmptyInviteModel(defaultRole));
                }}
              >
                <Plus className={'mr-1 h-3'} />

                <span>
                  <Trans i18nKey={'teams:addAnotherMemberButtonLabel'} />
                </span>
              </Button>
            </div>
          </If>
        </div>

        <Button type={'submit'} disabled={pending}>
          <Trans
            i18nKey={
              pending
                ? 'teams:invitingMembers'
                : 'teams:inviteMembersButtonLabel'
            }
          />
        </Button>
      </form>
    </Form>
  );
}

function createEmptyInviteModel(role: Role = 'staff') {
  return {
    firstName: '',
    lastName: '',
    email: '',
    role,
    projectId: null as string | null,
    seatKind: 'billable' as 'billable' | 'support',
  };
}
function useFetchInvitationsPolicies({
  accountSlug,
  isOpen,
}: {
  accountSlug: string;
  isOpen: boolean;
}) {
  return useQuery({
    queryKey: ['invitation-policies', accountSlug],
    queryFn: async () => {
      const response = await fetch(`/home/${accountSlug}/members/policies`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    },
    enabled: isOpen,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
