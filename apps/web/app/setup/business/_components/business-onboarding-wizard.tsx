'use client';

import { useMemo, useState, useSyncExternalStore, useTransition } from 'react';

import { isRedirectError } from 'next/dist/client/components/redirect-error';
import Link from 'next/link';

import { ArrowRight, Download, Mail, SkipForward } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import { AppLogo } from '~/components/app-logo';
import {
  clampBillableSeats,
  estimateMonthlyGbp,
} from '~/lib/billing/business-graduated-pricing';
import { estimateStarterMonthlyGbp } from '~/lib/billing/business-starter-pricing';
import { formatGbp } from '~/lib/billing/pricing-marketing';
import { normalizeDomainInput } from '~/lib/clients/client-logo-domain';
import { googleFaviconUrl } from '~/lib/clients/client-logo-icons';
import { OZER_ASSISTANT_DOWNLOAD } from '~/lib/marketing/assistant-download';
import {
  assistantDownloadMailto,
  isMacDesktopClient,
} from '~/lib/marketing/assistant-platform';
import { workspaceBtnPrimary } from '~/lib/workspace-ui';
import { isNextProductionDigestMessage } from '~/lib/workspace/onboarding-public-error';

import {
  BUSINESS_ONBOARDING_STEPS,
  BUSINESS_ONBOARDING_STEP_LABELS,
  type BusinessOnboardingStep,
} from '../_lib/business-onboarding-steps';
import {
  completeBusinessLiteAction,
  continueBusinessAssistantAction,
  saveBusinessClientAction,
  saveBusinessCompanyAction,
  saveBusinessTaskAction,
  skipBusinessTaskAction,
  startBusinessPaidPlanAction,
} from '../_lib/server/business-onboarding.actions';
import { WebsiteLogoPreview } from './website-logo-preview';

function subscribeMacDesktop() {
  return () => undefined;
}

function getMacDesktopSnapshot() {
  return isMacDesktopClient(
    window.navigator.userAgent,
    window.navigator.maxTouchPoints ?? 0,
  );
}

function getMacDesktopServerSnapshot() {
  return false;
}

type WizardAccount = {
  id: string;
  slug: string;
  name: string;
  picture_url: string | null;
};

type WizardClient = {
  id: string;
  name: string;
  website: string | null;
  pictureUrl: string | null;
  email: string | null;
};

export function BusinessOnboardingWizard(props: {
  initialStep: BusinessOnboardingStep;
  account: WizardAccount | null;
  clientId: string | null;
  client: WizardClient | null;
  taskTitle: string | null;
  userEmail: string | null;
  initialFirstName: string;
  initialLastName: string;
}) {
  const [step, setStep] = useState<BusinessOnboardingStep>(props.initialStep);
  const [account, setAccount] = useState(props.account);
  const [client, setClient] = useState(props.client);
  const [createdTaskTitle, setCreatedTaskTitle] = useState(props.taskTitle);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isMacDesktop = useSyncExternalStore(
    subscribeMacDesktop,
    getMacDesktopSnapshot,
    getMacDesktopServerSnapshot,
  );

  const [companyName, setCompanyName] = useState(account?.name ?? '');
  const [website, setWebsite] = useState('');
  const [firstName, setFirstName] = useState(props.initialFirstName);
  const [lastName, setLastName] = useState(props.initialLastName);

  const [clientName, setClientName] = useState(client?.name ?? '');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState(client?.email ?? '');
  const [clientWebsite, setClientWebsite] = useState(client?.website ?? '');
  const [enablePortal, setEnablePortal] = useState(false);

  const [taskTitle, setTaskTitle] = useState('');
  const [taskNotes, setTaskNotes] = useState('');

  const [paidPlan, setPaidPlan] = useState<'lite' | 'starter' | 'pro'>('lite');
  const [seats, setSeats] = useState(2);

  const stepIndex = BUSINESS_ONBOARDING_STEPS.indexOf(step);
  const billable = clampBillableSeats(seats);
  const paidEstimate =
    paidPlan === 'starter'
      ? estimateStarterMonthlyGbp(billable)
      : paidPlan === 'pro'
        ? estimateMonthlyGbp(billable)
        : 0;

  const run = (task: () => Promise<void>) => {
    setError(null);
    startTransition(async () => {
      try {
        await task();
      } catch (caught) {
        if (isRedirectError(caught)) throw caught;
        const message =
          caught instanceof Error ? caught.message : 'Something went wrong.';
        setError(
          isNextProductionDigestMessage(message)
            ? 'Could not create your workspace. Please try again.'
            : message,
        );
      }
    });
  };

  const extractTitleFromPaste = () => {
    const lines = taskNotes
      .split('\n')
      .map((line) => line.replace(/^[-*•\d.)\s]+/, '').trim())
      .filter(Boolean);
    if (lines[0] && !taskTitle.trim()) {
      setTaskTitle(lines[0].slice(0, 200));
    }
  };

  const clientLogoSrc = useMemo(() => {
    if (client?.pictureUrl) return client.pictureUrl;
    const domain = normalizeDomainInput(client?.website ?? clientWebsite);
    return domain ? googleFaviconUrl(domain, 128) : null;
  }, [client?.pictureUrl, client?.website, clientWebsite]);

  const assistantDownloadUrl =
    typeof window === 'undefined'
      ? OZER_ASSISTANT_DOWNLOAD.latestFilePath
      : new URL(OZER_ASSISTANT_DOWNLOAD.latestFilePath, window.location.origin)
          .href;

  const planCards = useMemo(
    () =>
      [
        {
          id: 'lite' as const,
          label: 'Free',
          caption: 'No card · 2 seats · capped CRM',
        },
        {
          id: 'starter' as const,
          label: 'Starter',
          caption: 'Card + 14-day trial · £14 then £9/seat',
        },
        {
          id: 'pro' as const,
          label: 'Pro',
          caption: 'Card + 14-day trial · £29 then £22/seat',
        },
      ] as const,
    [],
  );

  return (
    <div className="flex min-h-screen flex-col bg-[var(--workspace-shell-canvas)] text-[var(--workspace-shell-text)] md:flex-row">
      <aside className="w-full border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-6 py-6 md:w-64 md:border-r md:border-b-0">
        <AppLogo href={null} className="h-8 w-auto" />
        <ol className="mt-8 space-y-3">
          {BUSINESS_ONBOARDING_STEPS.map((item, index) => {
            const done = index < stepIndex;
            const active = item === step;
            return (
              <li
                key={item}
                className={cn(
                  'flex items-center gap-3 text-sm',
                  active
                    ? 'font-semibold text-[var(--workspace-shell-text)]'
                    : done
                      ? 'text-[var(--workspace-shell-text)]'
                      : 'text-[var(--workspace-shell-text-muted)]',
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs',
                    active || done
                      ? 'bg-[var(--ozer-accent)] text-[var(--ozer-white)]'
                      : 'bg-[var(--workspace-shell-sidebar-accent)]',
                  )}
                >
                  {done ? '✓' : index + 1}
                </span>
                {BUSINESS_ONBOARDING_STEP_LABELS[item]}
              </li>
            );
          })}
        </ol>
      </aside>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
        {step === 'company' ? (
          <section
            className="space-y-6"
            data-test="business-onboarding-company"
          >
            <header className="space-y-2">
              <h1 className="font-heading text-2xl font-semibold">
                Your company
              </h1>
              <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                We’ll pull a logo from your website when we can. You can change
                this later in Brand settings.
              </p>
            </header>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="onboard-first-name">First name</Label>
                  <Input
                    id="onboard-first-name"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    autoComplete="given-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="onboard-last-name">Last name</Label>
                  <Input
                    id="onboard-last-name"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    autoComplete="family-name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="onboard-company-name">Company name</Label>
                <Input
                  id="onboard-company-name"
                  data-test="business-company-name"
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder="Oodle Design"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="onboard-company-website">Website</Label>
                <Input
                  id="onboard-company-website"
                  data-test="business-company-website"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                  placeholder="oodle.design"
                />
                <WebsiteLogoPreview
                  website={website}
                  fallbackLetter={companyName}
                />
              </div>
            </div>
            <Button
              type="button"
              disabled={pending || !companyName.trim()}
              className={cn(workspaceBtnPrimary, 'h-11 w-full')}
              onClick={() =>
                run(async () => {
                  const result = await saveBusinessCompanyAction({
                    name: companyName.trim(),
                    website,
                    firstName,
                    lastName,
                  });
                  if (
                    result.error ||
                    !result.accountId ||
                    !result.accountSlug
                  ) {
                    setError(
                      result.error ??
                        'Could not create your workspace. Please try again.',
                    );
                    return;
                  }
                  setAccount({
                    id: result.accountId,
                    slug: result.accountSlug,
                    name: companyName.trim(),
                    picture_url: result.pictureUrl ?? null,
                  });
                  setStep(result.nextStep);
                })
              }
            >
              Continue
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </section>
        ) : null}

        {step === 'client' && account ? (
          <section className="space-y-6" data-test="business-onboarding-client">
            <header className="space-y-2">
              <h1 className="font-heading text-2xl font-semibold">
                Add one client
              </h1>
              <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                A real client makes the rest of Ozer useful. Logo is fetched
                from their website when possible.
              </p>
            </header>
            {account.picture_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={account.picture_url}
                alt=""
                className="h-12 w-12 rounded-xl object-cover"
              />
            ) : null}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="onboard-client-name">Client name</Label>
                <Input
                  id="onboard-client-name"
                  data-test="business-client-name"
                  value={clientName}
                  onChange={(event) => setClientName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="onboard-contact-name">Contact</Label>
                <Input
                  id="onboard-contact-name"
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                  placeholder="Jane Smith"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="onboard-contact-email">Contact email</Label>
                <Input
                  id="onboard-contact-email"
                  type="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="onboard-client-website">
                  Client website (optional)
                </Label>
                <Input
                  id="onboard-client-website"
                  value={clientWebsite}
                  onChange={(event) => setClientWebsite(event.target.value)}
                />
                <WebsiteLogoPreview
                  website={clientWebsite}
                  fallbackLetter={clientName}
                  label="Client logo preview"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-[var(--workspace-shell-text-muted)]">
                <input
                  type="checkbox"
                  checked={enablePortal}
                  onChange={(event) => setEnablePortal(event.target.checked)}
                  className="rounded border-[color:var(--workspace-shell-border)]"
                />
                Enable client portal
                {enablePortal && !contactEmail.trim()
                  ? ' — add an email to send the invite'
                  : ''}
              </label>
            </div>
            <Button
              type="button"
              disabled={pending || !clientName.trim()}
              className={cn(workspaceBtnPrimary, 'h-11 w-full')}
              onClick={() =>
                run(async () => {
                  const result = await saveBusinessClientAction({
                    accountId: account.id,
                    companyName: clientName.trim(),
                    contactName,
                    contactEmail,
                    website: clientWebsite,
                    enablePortal,
                  });
                  if (result.error || !result.clientId) {
                    setError(result.error ?? 'Could not add the client.');
                    return;
                  }
                  if (!result.client) {
                    setError('Could not add the client.');
                    return;
                  }
                  setClient(result.client);
                  setStep(result.nextStep);
                })
              }
            >
              Continue
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </section>
        ) : null}

        {step === 'task' && account ? (
          <section className="space-y-6" data-test="business-onboarding-task">
            <header className="space-y-2">
              <h1 className="font-heading text-2xl font-semibold">
                {account.name} is ready
              </h1>
              <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                Your first client is in the workspace. Add a first task if you
                want — or skip and keep moving.
              </p>
            </header>

            {client ? (
              <div
                className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4"
                data-test="business-onboarding-reveal"
              >
                <p className="text-xs font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
                  Client
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-[var(--workspace-shell-sidebar-accent)]">
                    {clientLogoSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={clientLogoSrc}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span className="text-sm font-semibold">
                        {client.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{client.name}</p>
                    <p className="truncate text-sm text-[var(--workspace-shell-text-muted)]">
                      {client.website || client.email || 'Added just now'}
                    </p>
                  </div>
                </div>
                {createdTaskTitle ? (
                  <div className="mt-4 rounded-xl border border-[color:var(--workspace-shell-border)] px-3 py-2">
                    <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                      On the board
                    </p>
                    <p className="text-sm font-medium">{createdTaskTitle}</p>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-3 py-2 text-sm text-[var(--workspace-shell-text-muted)]">
                    Task list is empty — add one below if you like.
                  </div>
                )}
              </div>
            ) : null}

            {!createdTaskTitle ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="onboard-task-title">First task</Label>
                  <Input
                    id="onboard-task-title"
                    data-test="business-task-title"
                    value={taskTitle}
                    onChange={(event) => setTaskTitle(event.target.value)}
                    placeholder="Send proposal to Acme"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="onboard-task-notes">
                    Paste email or notes (optional)
                  </Label>
                  <Textarea
                    id="onboard-task-notes"
                    value={taskNotes}
                    onChange={(event) => setTaskNotes(event.target.value)}
                    rows={4}
                  />
                  {taskNotes.trim().length >= 8 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={extractTitleFromPaste}
                    >
                      Use first line as the task
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              {createdTaskTitle ? (
                <Button
                  type="button"
                  disabled={pending}
                  className={cn(workspaceBtnPrimary, 'h-11 flex-1')}
                  onClick={() =>
                    run(async () => {
                      const result = await skipBusinessTaskAction({
                        accountId: account.id,
                      });
                      if (result.error || !result.nextStep) {
                        setError(result.error ?? 'Could not continue setup.');
                        return;
                      }
                      setStep(result.nextStep);
                    })
                  }
                >
                  Continue
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    disabled={pending || !taskTitle.trim()}
                    className={cn(workspaceBtnPrimary, 'h-11 flex-1')}
                    onClick={() =>
                      run(async () => {
                        const result = await saveBusinessTaskAction({
                          accountId: account.id,
                          clientId: client?.id ?? props.clientId ?? undefined,
                          title: taskTitle.trim(),
                          notes: taskNotes,
                        });
                        if (result.error || !result.nextStep) {
                          setError(result.error ?? 'Could not add the task.');
                          return;
                        }
                        setCreatedTaskTitle(
                          result.taskTitle ?? taskTitle.trim(),
                        );
                        setStep(result.nextStep);
                      })
                    }
                  >
                    Add task and continue
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    className="h-11"
                    onClick={() =>
                      run(async () => {
                        const result = await skipBusinessTaskAction({
                          accountId: account.id,
                        });
                        if (result.error || !result.nextStep) {
                          setError(result.error ?? 'Could not skip this step.');
                          return;
                        }
                        setStep(result.nextStep);
                      })
                    }
                  >
                    <SkipForward className="mr-1.5 h-4 w-4" />
                    Skip
                  </Button>
                </>
              )}
            </div>
          </section>
        ) : null}

        {step === 'assistant' && account ? (
          <section
            className="space-y-6"
            data-test="business-onboarding-assistant"
          >
            {isMacDesktop ? (
              <>
                <header className="space-y-2">
                  <h1 className="font-heading text-2xl font-semibold">
                    Download Ozer Assistant
                  </h1>
                  <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                    The Mac app records meetings, captures tasks, and stays in
                    the menu bar. {OZER_ASSISTANT_DOWNLOAD.requirementsLabel}.
                  </p>
                </header>
                <a
                  href={OZER_ASSISTANT_DOWNLOAD.latestFilePath}
                  className={cn(
                    workspaceBtnPrimary,
                    'inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold',
                  )}
                  data-test="business-assistant-download"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download for Mac
                </a>
                <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                  Or read more on the{' '}
                  <Link
                    href={OZER_ASSISTANT_DOWNLOAD.pagePath}
                    className="text-[var(--ozer-accent)] underline-offset-2 hover:underline"
                  >
                    download page
                  </Link>
                  .
                </p>
              </>
            ) : (
              <>
                <header className="space-y-2">
                  <h1 className="font-heading text-2xl font-semibold">
                    Ozer Assistant lives on Mac
                  </h1>
                  <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                    You’re on a phone or another device. Email yourself the
                    download link and install it on a Mac later — this step
                    isn’t required to continue.
                  </p>
                </header>
                <a
                  href={assistantDownloadMailto(
                    props.userEmail ?? '',
                    assistantDownloadUrl,
                  )}
                  className={cn(
                    workspaceBtnPrimary,
                    'inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold',
                  )}
                  data-test="business-assistant-email-link"
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Email me the Mac download link
                </a>
              </>
            )}
            <Button
              type="button"
              disabled={pending}
              className={cn(workspaceBtnPrimary, 'h-11 w-full')}
              onClick={() =>
                run(async () => {
                  const result = await continueBusinessAssistantAction({
                    accountId: account.id,
                  });
                  if (result.error || !result.nextStep) {
                    setError(result.error ?? 'Could not continue setup.');
                    return;
                  }
                  setStep(result.nextStep);
                })
              }
            >
              Continue
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </section>
        ) : null}

        {step === 'plan' && account ? (
          <section className="space-y-6" data-test="business-onboarding-plan">
            <header className="space-y-2">
              <h1 className="font-heading text-2xl font-semibold">
                Your workspace is already working
              </h1>
              <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                {client?.name
                  ? `${client.name} is in ${account.name}.`
                  : `${account.name} is set up.`}{' '}
                Stay on Free, or start a 14-day trial on Starter or Pro.
              </p>
            </header>
            <div className="grid gap-3">
              {planCards.map((option) => {
                const active = paidPlan === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setPaidPlan(option.id)}
                    className={cn(
                      'rounded-xl border px-4 py-3 text-left',
                      active
                        ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent-subtle)]'
                        : 'border-[color:var(--workspace-shell-border)]',
                    )}
                  >
                    <p className="text-sm font-semibold">{option.label}</p>
                    <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                      {option.caption}
                    </p>
                  </button>
                );
              })}
            </div>
            {paidPlan !== 'lite' ? (
              <div className="space-y-2">
                <Label htmlFor="onboard-seats">Seats</Label>
                <Input
                  id="onboard-seats"
                  type="number"
                  min={1}
                  max={200}
                  value={billable}
                  onChange={(event) =>
                    setSeats(
                      clampBillableSeats(Number(event.target.value) || 1),
                    )
                  }
                />
                <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                  Estimated {formatGbp(paidEstimate)}/mo after the 14-day trial.
                </p>
              </div>
            ) : null}
            <Button
              type="button"
              disabled={pending}
              className={cn(workspaceBtnPrimary, 'h-11 w-full')}
              data-test="business-plan-continue"
              onClick={() =>
                run(async () => {
                  if (paidPlan === 'lite') {
                    const result = await completeBusinessLiteAction({
                      accountId: account.id,
                    });
                    if (result.error || !result.redirectTo) {
                      setError(result.error ?? 'Could not finish setup.');
                      return;
                    }
                    window.location.assign(result.redirectTo);
                    return;
                  }
                  const result = await startBusinessPaidPlanAction({
                    accountId: account.id,
                    productId:
                      paidPlan === 'starter'
                        ? 'ozer-business-starter'
                        : 'ozer-business',
                    seats: billable,
                  });
                  if (result.error || !result.redirectTo) {
                    setError(result.error ?? 'Could not start checkout.');
                    return;
                  }
                  window.location.assign(result.redirectTo);
                })
              }
            >
              {paidPlan === 'lite' ? 'Start on Free' : 'Continue to checkout'}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </section>
        ) : null}

        {error ? (
          <p className="mt-6 text-sm text-rose-600" role="alert">
            {error}
          </p>
        ) : null}
      </main>
    </div>
  );
}
