'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

import Link from 'next/link';

import { toast } from '@kit/ui/sonner';

import {
  type InsufficientAiCreditsPayload,
  getAiCreditsExhaustedStorageKey,
} from '~/lib/ai/ai-credits-exhausted';

export type ReportAiCreditsExhaustedInput = {
  accountId: string;
  billingHref: string;
  creditsRemaining?: number;
  creditsRequired?: number;
  error?: string;
};

type BannerState = {
  visible: boolean;
  creditsRemaining?: number;
  creditsRequired?: number;
};

type AiCreditsExhaustedContextValue = {
  accountId: string;
  billingHref: string;
  reportExhausted: (input: ReportAiCreditsExhaustedInput) => void;
  banner: BannerState;
  dismissBanner: () => void;
};

const AiCreditsExhaustedContext =
  createContext<AiCreditsExhaustedContextValue | null>(null);

const TOAST_DEBOUNCE_MS = 4_000;

function readDismissed(accountId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      sessionStorage.getItem(getAiCreditsExhaustedStorageKey(accountId)) === '1'
    );
  } catch {
    return false;
  }
}

function writeDismissed(accountId: string, dismissed: boolean) {
  if (typeof window === 'undefined') return;
  try {
    const key = getAiCreditsExhaustedStorageKey(accountId);
    if (dismissed) {
      sessionStorage.setItem(key, '1');
    } else {
      sessionStorage.removeItem(key);
    }
  } catch {
    // ignore storage failures
  }
}

export function AiCreditsExhaustedProvider({
  accountId,
  billingHref,
  children,
}: {
  accountId: string;
  billingHref: string;
  children: React.ReactNode;
}) {
  const [banner, setBanner] = useState<BannerState>({ visible: false });
  const [dismissed, setDismissed] = useState(() => readDismissed(accountId));
  const lastToastAt = useRef(0);

  const dismissBanner = useCallback(() => {
    writeDismissed(accountId, true);
    setDismissed(true);
    setBanner((prev) => ({ ...prev, visible: false }));
  }, [accountId]);

  const reportExhausted = useCallback(
    (input: ReportAiCreditsExhaustedInput) => {
      const href = input.billingHref || billingHref;
      const id = input.accountId || accountId;

      writeDismissed(id, false);
      setDismissed(false);

      setBanner({
        visible: true,
        creditsRemaining: input.creditsRemaining,
        creditsRequired: input.creditsRequired,
      });

      window.dispatchEvent(
        new CustomEvent('ozer:ai-credits-exhausted', {
          detail: { accountId: id },
        }),
      );

      const now = Date.now();
      if (now - lastToastAt.current < TOAST_DEBOUNCE_MS) {
        return;
      }
      lastToastAt.current = now;

      const detail =
        typeof input.creditsRequired === 'number' &&
        typeof input.creditsRemaining === 'number'
          ? ` Need ${input.creditsRequired}, have ${input.creditsRemaining}.`
          : '';

      toast.error(`You're out of AI credits.${detail}`, {
        action: {
          label: 'Top up',
          onClick: () => {
            window.location.assign(href);
          },
        },
        description: (
          <Link href={href} className="underline">
            Top up AI credits
          </Link>
        ),
      });
    },
    [accountId, billingHref],
  );

  const value = useMemo(
    () => ({
      accountId,
      billingHref,
      reportExhausted,
      banner: {
        ...banner,
        visible: banner.visible && !dismissed,
      },
      dismissBanner,
    }),
    [accountId, banner, billingHref, dismissBanner, dismissed, reportExhausted],
  );

  return (
    <AiCreditsExhaustedContext.Provider value={value}>
      {children}
    </AiCreditsExhaustedContext.Provider>
  );
}

export function useAiCreditsExhausted() {
  const ctx = useContext(AiCreditsExhaustedContext);
  if (!ctx) {
    return {
      accountId: '',
      billingHref: '',
      reportExhausted: (_input: ReportAiCreditsExhaustedInput) => {
        // Provider missing — no-op so callers can stay unconditional.
      },
      banner: { visible: false } as BannerState,
      dismissBanner: () => undefined,
    };
  }
  return ctx;
}

export function useReportAiCreditsExhausted() {
  return useAiCreditsExhausted().reportExhausted;
}

export function reportFromInsufficientPayload(
  report: (input: ReportAiCreditsExhaustedInput) => void,
  payload: Partial<InsufficientAiCreditsPayload> & {
    accountId: string;
    billingHref: string;
  },
) {
  report({
    accountId: payload.accountId,
    billingHref: payload.billingHref,
    creditsRemaining: payload.creditsRemaining,
    creditsRequired: payload.creditsRequired,
    error: payload.error,
  });
}
