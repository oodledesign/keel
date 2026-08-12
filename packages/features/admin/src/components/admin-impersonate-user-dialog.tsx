'use client';

import { useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
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
import { LoadingOverlay } from '@kit/ui/loading-overlay';
import { Textarea } from '@kit/ui/textarea';

import { impersonateUserAction } from '../lib/server/admin-server-actions';
import { ImpersonateUserSchema } from '../lib/server/schema/admin-actions.schema';

type SessionTokens = {
  accessToken: string;
  refreshToken: string;
  nonce: string;
};

export function AdminImpersonateUserDialog(
  props: React.PropsWithChildren<{
    userId: string;
    reason?: string;
    supportTicketId?: string | null;
  }>,
) {
  const form = useForm({
    resolver: zodResolver(ImpersonateUserSchema),
    defaultValues: {
      userId: props.userId,
      confirmation: '',
      reason: props.reason ?? '',
      supportTicketId: props.supportTicketId ?? null,
    },
  });

  const [tokens, setTokens] = useState<SessionTokens>();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (tokens) {
    return (
      <>
        <ImpersonateUserAuthSetter tokens={tokens} />

        <LoadingOverlay>Setting up your session...</LoadingOverlay>
      </>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{props.children}</AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Impersonate User</AlertDialogTitle>

          <AlertDialogDescription className={'flex flex-col space-y-1'}>
            <span>
              You will be signed in as this user to diagnose support issues. Use
              the floating <b>Back to admin</b> control on the right to restore
              your super-admin session.
            </span>

            <span>
              <b>NB:</b> If the user has 2FA enabled, you will not be able to
              impersonate them.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Form {...form}>
          <form
            data-test={'admin-impersonate-user-form'}
            className={'flex flex-col space-y-8'}
            onSubmit={form.handleSubmit((data) => {
              startTransition(async () => {
                try {
                  const result = await impersonateUserAction(data);

                  setTokens({
                    ...result,
                    nonce: crypto.randomUUID(),
                  });
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : 'Failed to impersonate user',
                  );
                }
              });
            })}
          >
            <If condition={Boolean(error)}>
              <Alert variant={'destructive'}>
                <AlertTitle>Error</AlertTitle>

                <AlertDescription>
                  {error ??
                    'Failed to impersonate user. Please check the logs to understand what went wrong.'}
                </AlertDescription>
              </Alert>
            </If>

            <FormField
              name={'reason'}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>

                  <FormControl>
                    <Textarea
                      required
                      minLength={3}
                      maxLength={500}
                      placeholder={'Support ticket / what you need to verify'}
                      {...field}
                    />
                  </FormControl>

                  <FormDescription>
                    Logged in the admin audit trail. Minimum 3 characters.
                  </FormDescription>

                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name={'confirmation'}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Type <b>CONFIRM</b> to confirm
                  </FormLabel>

                  <FormControl>
                    <Input
                      required
                      pattern={'CONFIRM'}
                      placeholder={'Type CONFIRM to confirm'}
                      {...field}
                    />
                  </FormControl>

                  <FormDescription>
                    Are you sure you want to impersonate this user?
                  </FormDescription>

                  <FormMessage />
                </FormItem>
              )}
            />

            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>

              <Button disabled={isPending} type={'submit'}>
                {isPending ? 'Impersonating...' : 'Impersonate User'}
              </Button>
            </AlertDialogFooter>
          </form>
        </Form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ImpersonateUserAuthSetter(props: { tokens: SessionTokens }) {
  useSetSession(props.tokens);

  return <LoadingOverlay>Setting up your session...</LoadingOverlay>;
}

function useSetSession(tokens: SessionTokens) {
  const supabase = useSupabase();

  return useQuery({
    // Opaque nonce only — never put bearer tokens in the query cache key.
    queryKey: ['impersonate-user', tokens.nonce],
    gcTime: 0,
    queryFn: async () => {
      await supabase.auth.signOut({ scope: 'local' });

      await supabase.auth.setSession({
        refresh_token: tokens.refreshToken,
        access_token: tokens.accessToken,
      });

      // use a hard refresh to avoid hitting cached pages
      window.location.replace('/app');
    },
  });
}
