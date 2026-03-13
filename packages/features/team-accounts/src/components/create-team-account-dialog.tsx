'use client';

import { useMemo, useState, useTransition } from 'react';

import { isRedirectError } from 'next/dist/client/components/redirect-error';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';

import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@kit/ui/form';
import { If } from '@kit/ui/if';
import { Input } from '@kit/ui/input';
import { Trans } from '@kit/ui/trans';

import {
  CreateTeamSchema,
  NON_LATIN_REGEX,
} from '../schema/create-team.schema';
import { createTeamAccountAction } from '../server/actions/create-team-account-server-actions';

export function CreateTeamAccountDialog(
  props: React.PropsWithChildren<{
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
  }>,
) {
  return (
    <Dialog open={props.isOpen} onOpenChange={props.setIsOpen}>
      <DialogContent
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            <Trans i18nKey={'teams:createTeamModalHeading'} />
          </DialogTitle>

          <DialogDescription>
            <Trans i18nKey={'teams:createTeamModalDescription'} />
          </DialogDescription>
        </DialogHeader>

        <CreateOrganizationAccountForm onClose={() => props.setIsOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function CreateOrganizationAccountForm(props: { onClose: () => void }) {
  const [error, setError] = useState<{ message?: string } | undefined>();
  const [pending, startTransition] = useTransition();

  const form = useForm({
    defaultValues: {
      name: '',
      slug: '',
    },
    resolver: zodResolver(CreateTeamSchema),
  });

  const nameValue = useWatch({ control: form.control, name: 'name' });

  const showSlugField = useMemo(
    () => NON_LATIN_REGEX.test(nameValue ?? ''),
    [nameValue],
  );

  return (
    <Form {...form}>
      <form
        data-test={'create-team-form'}
        onSubmit={form.handleSubmit((data) => {
          startTransition(async () => {
            try {
              const result = await createTeamAccountAction(data);

              if (result.error) {
                setError({ message: result.message });
              }
            } catch (e) {
              if (!isRedirectError(e)) {
                setError({});
              }
            }
          });
        })}
      >
        <div className={'flex flex-col space-y-4'}>
          <If condition={error}>
            <CreateOrganizationErrorAlert message={error?.message} />
          </If>

          <FormField
            name={'name'}
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>
                    <Trans i18nKey={'teams:teamNameLabel'} />
                  </FormLabel>

                  <FormControl>
                    <Input
                      data-test={'team-name-input'}
                      required
                      minLength={2}
                      maxLength={50}
                      placeholder={''}
                      {...field}
                    />
                  </FormControl>

                  <FormDescription>
                    <Trans i18nKey={'teams:teamNameDescription'} />
                  </FormDescription>

                  <FormMessage />
                </FormItem>
              );
            }}
          />

          <If condition={showSlugField}>
            <FormField
              name={'slug'}
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormLabel>
                      <Trans i18nKey={'teams:teamSlugLabel'} />
                    </FormLabel>

                    <FormControl>
                      <Input
                        data-test={'team-slug-input'}
                        required
                        minLength={2}
                        maxLength={50}
                        placeholder={'my-team'}
                        {...field}
                      />
                    </FormControl>

                    <FormDescription>
                      <Trans i18nKey={'teams:teamSlugDescription'} />
                    </FormDescription>

                    <FormMessage />
                  </FormItem>
                );
              }}
            />
          </If>

          <div className={'flex justify-end space-x-2'}>
            <Button
              variant={'outline'}
              type={'button'}
              disabled={pending}
              onClick={props.onClose}
            >
              <Trans i18nKey={'common:cancel'} />
            </Button>

            <Button data-test={'confirm-create-team-button'} disabled={pending}>
              {pending ? (
                <Trans i18nKey={'teams:creatingTeam'} />
              ) : (
                <Trans i18nKey={'teams:createTeamSubmitLabel'} />
              )}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}

function CreateOrganizationErrorAlert(props: { message?: string }) {
  return (
    <Alert variant={'destructive'}>
      <AlertTitle>
        <Trans i18nKey={'teams:createTeamErrorHeading'} />
      </AlertTitle>

      <AlertDescription>
        {props.message ? (
          <Trans i18nKey={props.message} defaults={props.message} />
        ) : (
          <Trans i18nKey={'teams:createTeamErrorMessage'} />
        )}
      </AlertDescription>
    </Alert>
  );
}
