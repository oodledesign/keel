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
        <Tabs
          value={selectedMethod}
          onValueChange={(value) =>
            setSelectedMethod(value as 'password' | 'magic-link')
          }
        >
          <TabsList className="bg-muted/70 text-muted-foreground h-9 w-full rounded-full border border-black/5 p-0.5 shadow-none">
            <TabsTrigger
              value="password"
              className="text-muted-foreground data-[state=active]:text-foreground h-8 flex-1 rounded-full px-3 text-xs font-medium shadow-none transition-colors data-[state=active]:bg-white data-[state=active]:shadow-none"
            >
              <Trans i18nKey="auth:signInMethodPassword" />
            </TabsTrigger>
            <TabsTrigger
              value="magic-link"
              className="text-muted-foreground data-[state=active]:text-foreground h-8 flex-1 rounded-full px-3 text-xs font-medium shadow-none transition-colors data-[state=active]:bg-white data-[state=active]:shadow-none"
            >
              <Trans i18nKey="auth:signInMethodMagicLink" />
            </TabsTrigger>
          </TabsList>
        </Tabs>
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
