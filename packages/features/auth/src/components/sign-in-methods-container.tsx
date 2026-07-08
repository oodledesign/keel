'use client';

import { useCallback, useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';

import type { Provider } from '@supabase/supabase-js';

import { isBrowser } from '@kit/shared/utils';
import { If } from '@kit/ui/if';
import { Separator } from '@kit/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@kit/ui/tabs';
import { Trans } from '@kit/ui/trans';

import { LastAuthMethodHint } from './last-auth-method-hint';
import { MagicLinkAuthContainer } from './magic-link-auth-container';
import { OauthProviders } from './oauth-providers';
import { OtpSignInContainer } from './otp-sign-in-container';
import { PasswordSignInContainer } from './password-sign-in-container';

export function SignInMethodsContainer(props: {
  paths: {
    callback: string;
    joinTeam: string;
    returnPath: string;
  };

  providers: {
    password: boolean;
    magicLink: boolean;
    otp: boolean;
    oAuth: Provider[];
  };

  captchaSiteKey?: string;
}) {
  const router = useRouter();

  const redirectUrl = isBrowser()
    ? new URL(props.paths.callback, window?.location.origin).toString()
    : '';

  const onSignIn = useCallback(() => {
    const returnPath = props.paths.returnPath || '/app';

    router.replace(returnPath);
  }, [props.paths.returnPath, router]);

  const availableEmailMethods = useMemo(() => {
    return [
      props.providers.password ? 'password' : null,
      props.providers.magicLink ? 'magic-link' : null,
    ].filter(Boolean) as Array<'password' | 'magic-link'>;
  }, [props.providers.magicLink, props.providers.password]);

  const [selectedMethod, setSelectedMethod] = useState<
    'password' | 'magic-link'
  >(availableEmailMethods[0] ?? 'password');

  const showMethodTabs = availableEmailMethods.length > 1;

  return (
    <>
      <LastAuthMethodHint />

      <If condition={showMethodTabs}>
        <div className="rounded-[22px] border border-white/10 bg-[var(--workspace-shell-panel)] p-1.5 shadow-[0_16px_34px_rgba(2,8,23,0.35)]">
          <Tabs
            value={selectedMethod}
            onValueChange={(value) =>
              setSelectedMethod(value as 'password' | 'magic-link')
            }
          >
            <TabsList className="grid h-auto w-full grid-cols-2 rounded-[18px] bg-[#0b132b]/80 p-0">
              <TabsTrigger
                value="password"
                className="rounded-[16px] px-4 py-2.5 text-[15px] font-medium text-zinc-300 transition-colors data-[state=active]:bg-[var(--ozer-accent)] data-[state=active]:text-white data-[state=active]:shadow-none"
              >
                <Trans i18nKey="auth:signInMethodPassword" />
              </TabsTrigger>
              <TabsTrigger
                value="magic-link"
                className="rounded-[16px] px-4 py-2.5 text-[15px] font-medium text-zinc-300 transition-colors data-[state=active]:bg-[var(--ozer-accent)] data-[state=active]:text-white data-[state=active]:shadow-none"
              >
                <Trans i18nKey="auth:signInMethodMagicLink" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </If>

      <If condition={props.providers.password && selectedMethod === 'password'}>
        <PasswordSignInContainer
          onSignIn={onSignIn}
          captchaSiteKey={props.captchaSiteKey}
        />
      </If>

      <If
        condition={props.providers.magicLink && selectedMethod === 'magic-link'}
      >
        <MagicLinkAuthContainer
          redirectUrl={redirectUrl}
          shouldCreateUser={false}
          captchaSiteKey={props.captchaSiteKey}
        />
      </If>

      <If condition={props.providers.otp}>
        <OtpSignInContainer
          shouldCreateUser={false}
          captchaSiteKey={props.captchaSiteKey}
        />
      </If>

      <If condition={props.providers.oAuth.length}>
        <If
          condition={
            props.providers.magicLink ||
            props.providers.password ||
            props.providers.otp
          }
        >
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>

            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background text-muted-foreground px-2">
                <Trans i18nKey="auth:orContinueWith" />
              </span>
            </div>
          </div>
        </If>

        <OauthProviders
          enabledProviders={props.providers.oAuth}
          shouldCreateUser={false}
          paths={{
            callback: props.paths.callback,
            returnPath: props.paths.returnPath,
          }}
        />
      </If>
    </>
  );
}
