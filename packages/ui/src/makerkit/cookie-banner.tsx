'use client';

import { useCallback, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { Dialog as DialogPrimitive } from 'radix-ui';

import { Button } from '../shadcn/button';
import { Trans } from './trans';

// configure this as you wish
const COOKIE_CONSENT_STATUS = 'cookie_consent_status';

enum ConsentStatus {
  Accepted = 'accepted',
  Rejected = 'rejected',
  Unknown = 'unknown',
}

export const CookieBanner = dynamic(async () => CookieBannerComponent, {
  ssr: false,
});

export function CookieBannerComponent() {
  const { status, accept, reject } = useCookieConsent();

  if (!isBrowser()) {
    return null;
  }

  if (status !== ConsentStatus.Unknown) {
    return null;
  }

  return (
    <DialogPrimitive.Root open modal={false}>
      <DialogPrimitive.Content
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={`dark:shadow-primary-500/40 bg-background animate-in fade-in zoom-in-95 slide-in-from-bottom-16 fill-mode-both fixed bottom-0 z-50 w-full max-w-md border p-3 shadow-lg delay-1000 duration-1000 sm:p-4 lg:bottom-4 lg:left-4 lg:rounded-lg`}
      >
        <DialogPrimitive.Title className="text-sm font-semibold">
          <Trans i18nKey={'cookieBanner.title'} />
        </DialogPrimitive.Title>

        <div className={'mt-2 flex flex-col gap-2.5 sm:flex-row sm:items-end sm:justify-between sm:gap-3'}>
          <div className={'text-xs leading-snug text-gray-500 dark:text-gray-400 sm:max-w-[18rem]'}>
            <Trans i18nKey={'cookieBanner.description'} />
          </div>

          <div className={'flex shrink-0 justify-end gap-2'}>
            <Button variant={'ghost'} size={'sm'} onClick={reject}>
              <Trans i18nKey={'cookieBanner.reject'} />
            </Button>

            <Button autoFocus size={'sm'} onClick={accept}>
              <Trans i18nKey={'cookieBanner.accept'} />
            </Button>
          </div>
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Root>
  );
}

export function useCookieConsent() {
  const initialState = getStatusFromLocalStorage();
  const [status, setStatus] = useState<ConsentStatus>(initialState);

  const accept = useCallback(() => {
    const status = ConsentStatus.Accepted;

    setStatus(status);
    storeStatusInLocalStorage(status);
  }, []);

  const reject = useCallback(() => {
    const status = ConsentStatus.Rejected;

    setStatus(status);
    storeStatusInLocalStorage(status);
  }, []);

  const clear = useCallback(() => {
    const status = ConsentStatus.Unknown;

    setStatus(status);
    storeStatusInLocalStorage(status);
  }, []);

  return useMemo(() => {
    return {
      clear,
      status,
      accept,
      reject,
    };
  }, [clear, status, accept, reject]);
}

function storeStatusInLocalStorage(status: ConsentStatus) {
  if (!isBrowser()) {
    return;
  }

  localStorage.setItem(COOKIE_CONSENT_STATUS, status);
}

function getStatusFromLocalStorage() {
  if (!isBrowser()) {
    return ConsentStatus.Unknown;
  }

  const status = localStorage.getItem(COOKIE_CONSENT_STATUS) as ConsentStatus;

  return status ?? ConsentStatus.Unknown;
}

function isBrowser() {
  return typeof window !== 'undefined';
}
