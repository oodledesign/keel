'use client';

import { useTransition } from 'react';

import { isRedirectError } from 'next/dist/client/components/redirect-error';

import { zodResolver } from '@hookform/resolvers/zod';
import { Building, Link } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@kit/ui/button';
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@kit/ui/input-group';
import { toast } from '@kit/ui/sonner';
import { Trans } from '@kit/ui/trans';

import { containsNonLatinCharacters } from '../../schema/create-team.schema';
import { TeamNameFormSchema } from '../../schema/update-team-name.schema';
import { updateTeamAccountName } from '../../server/actions/team-details-server-actions';

export const UpdateTeamAccountNameForm = (props: {
  account: {
    name: string;
    slug: string;
  };

  path: string;
}) => {
  const [pending, startTransition] = useTransition();
  const { t } = useTranslation('teams');

  const form = useForm({
    resolver: zodResolver(TeamNameFormSchema),
    defaultValues: {
      name: props.account.name,
      newSlug: '',
    },
  });

  const nameValue = useWatch({ control: form.control, name: 'name' });
  const showSlugField = containsNonLatinCharacters(nameValue || '');

  return (
    <div className={'space-y-8'}>
      <Form {...form}>
        <form
          data-test={'update-team-account-name-form'}
          className={'flex flex-col space-y-4'}
          onSubmit={form.handleSubmit((data) => {
            startTransition(async () => {
              const toastId = toast.loading(t('updateTeamLoadingMessage'));

              try {
                const result = await updateTeamAccountName({
                  slug: props.account.slug,
                  name: data.name,
                  newSlug: data.newSlug || undefined,
                  path: props.path,
                });

                if (result.success) {
                  toast.success(t('updateTeamSuccessMessage'), {
                    id: toastId,
                  });
                } else if (result.error) {
                  toast.error(t(result.error), {
                    id: toastId,
                  });
                } else {
                  toast.error(t('updateTeamErrorMessage'), {
                    id: toastId,
                  });
                }
              } catch (error) {
                if (!isRedirectError(error)) {
                  toast.error(t('updateTeamErrorMessage'), {
                    id: toastId,
                  });
                } else {
                  toast.success(t('updateTeamSuccessMessage'), {
                    id: toastId,
                  });
                }
              }
            });
          })}
        >
          <FormField
            name={'name'}
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>
                    <Trans i18nKey={'teams:teamNameLabel'} />
                  </FormLabel>

                  <FormControl>
                    <InputGroup className="dark:bg-background">
                      <InputGroupAddon align="inline-start">
                        <Building className="h-4 w-4" />
                      </InputGroupAddon>

                      <InputGroupInput
                        data-test={'team-name-input'}
                        required
                        placeholder={t('teams:teamNameInputLabel')}
                        {...field}
                      />
                    </InputGroup>
                  </FormControl>

                  <FormMessage />
                </FormItem>
              );
            }}
          />

          <If condition={showSlugField}>
            <FormField
              name={'newSlug'}
              render={({ field }) => {
                return (
                  <FormItem>
                    <FormLabel>
                      <Trans i18nKey={'teams:teamSlugLabel'} />
                    </FormLabel>

                    <FormControl>
                      <InputGroup className="dark:bg-background">
                        <InputGroupAddon align="inline-start">
                          <Link className="h-4 w-4" />
                        </InputGroupAddon>

                        <InputGroupInput
                          data-test={'team-slug-input'}
                          required
                          placeholder={'my-team'}
                          {...field}
                        />
                      </InputGroup>
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

          <div>
            <Button
              className={'w-full md:w-auto'}
              data-test={'update-team-submit-button'}
              disabled={pending}
            >
              <Trans i18nKey={'teams:updateTeamSubmitLabel'} />
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};
