import { zodResolver } from '@hookform/resolvers/zod';
import { User } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Database } from '@kit/supabase/database';
import { Button } from '@kit/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@kit/ui/form';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@kit/ui/input-group';
import { toast } from '@kit/ui/sonner';
import { Trans } from '@kit/ui/trans';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';

import { useRevalidatePersonalAccountDataQuery } from '../../hooks/use-personal-account-data';
import { AccountDetailsSchema } from '../../schema/account-details.schema';

type UpdateUserDataParams = Database['public']['Tables']['accounts']['Update'];

export function UpdateAccountDetailsForm({
  firstName,
  lastName,
  onUpdate,
  userId,
}: {
  firstName: string;
  lastName: string;
  userId: string;
  onUpdate: (user: Partial<UpdateUserDataParams>) => void;
}) {
  const client = useSupabase();
  const revalidate = useRevalidatePersonalAccountDataQuery();
  const { t } = useTranslation('account');

  const form = useForm({
    resolver: zodResolver(AccountDetailsSchema),
    defaultValues: {
      first_name: firstName,
      last_name: lastName,
    },
  });

  const onSubmit = async ({
    first_name,
    last_name,
  }: {
    first_name: string;
    last_name?: string;
  }) => {
    const promise = (async () => {
      const { error: settingsError } = await client.from('user_settings').upsert(
        {
          user_id: userId,
          first_name: first_name.trim() || null,
          last_name: (last_name?.trim() ?? '') || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
      if (settingsError) throw settingsError;

      const displayName = [first_name.trim(), (last_name ?? '').trim()]
        .filter(Boolean)
        .join(' ')
        .trim();
      if (displayName) {
        const { error: accountError } = await client
          .from('accounts')
          .update({
            name: displayName,
            updated_at: new Date().toISOString(),
          })
          .eq('primary_owner_user_id', userId)
          .eq('is_personal_account', true);
        if (accountError) throw accountError;
      }

      revalidate(userId);
      onUpdate({ name: displayName || undefined });
    })();

    return toast.promise(promise, {
      success: t(`updateProfileSuccess`),
      error: t(`updateProfileError`),
      loading: t(`updateProfileLoading`),
    });
  };

  const isPending = form.formState.isSubmitting;

  return (
    <div className={'flex flex-col space-y-8'}>
      <Form {...form}>
        <form
          data-test={'update-account-name-form'}
          className={'flex flex-col space-y-4'}
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <FormField
            name={'first_name'}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <InputGroup className="dark:bg-background">
                    <InputGroupAddon align="inline-start">
                      <User className="h-4 w-4" />
                    </InputGroupAddon>

                    <InputGroupInput
                      data-test={'account-first-name'}
                      minLength={1}
                      placeholder={t('account:firstName')}
                      maxLength={100}
                      {...field}
                    />
                  </InputGroup>
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name={'last_name'}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <InputGroup className="dark:bg-background">
                    <InputGroupAddon align="inline-start">
                      <User className="h-4 w-4" />
                    </InputGroupAddon>

                    <InputGroupInput
                      data-test={'account-last-name'}
                      placeholder={t('account:lastName')}
                      maxLength={100}
                      {...field}
                    />
                  </InputGroup>
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />

          <div>
            <Button disabled={isPending}>
              <Trans i18nKey={'account:updateProfileSubmitLabel'} />
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
