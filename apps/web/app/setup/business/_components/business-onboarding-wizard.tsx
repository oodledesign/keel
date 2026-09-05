'use client';

import { useMemo, useState, useTransition } from 'react';

import { isRedirectError } from 'next/dist/client/components/redirect-error';
import Link from 'next/link';

import { ArrowRight, Download, SkipForward } from 'lucide-react';

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
import { OZER_ASSISTANT_DOWNLOAD } from '~/lib/marketing/assistant-download';
import { workspaceBtnPrimary } from '~/lib/workspace-ui';

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

type WizardAccount = {
  id: string;
  slug: string;
  name: string;
  picture_url: string | null;
};

export function BusinessOnboardingWizard(props: {
  initialStep: BusinessOnboardingStep;
  account: WizardAccount | null;
  clientId: string | null;
  userNeedsName: boolean;
}) {
  const [step, setStep] = useState<BusinessOnboardingStep>(props.initialStep);
  const [account, setAccount] = useState(props.account);
  const [clientId, setClientId] = useState(props.clientId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [companyName, setCompanyName] = useState(account?.name ?? '');
  const [website, setWebsite] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const [clientName, setClientName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [clientWebsite, setClientWebsite] = useState('');
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
        setError(
          caught instanceof Error ? caught.message : 'Something went wrong.',
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

  const logoUrl = account?.picture_url;

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
              {props.userNeedsName ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="onboard-first-name">First name</Label>
                    <Input
                      id="onboard-first-name"
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="onboard-last-name">Last name</Label>
                    <Input
                      id="onboard-last-name"
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                    />
                  </div>
                </div>
              ) : null}
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
                  setAccount({
                    id: result.accountId,
                    slug: result.accountSlug,
                    name: companyName.trim(),
                    picture_url: null,
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
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
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
                  setClientId(result.clientId);
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
                Add one task
              </h1>
              <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                Type a task, or paste an email / transcript and we’ll use the
                first action line. You can skip this.
              </p>
            </header>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="onboard-task-title">Task</Label>
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
                  rows={5}
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
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                disabled={pending || !taskTitle.trim()}
                className={cn(workspaceBtnPrimary, 'h-11 flex-1')}
                onClick={() =>
                  run(async () => {
                    const result = await saveBusinessTaskAction({
                      accountId: account.id,
                      clientId: clientId ?? undefined,
                      title: taskTitle.trim(),
                      notes: taskNotes,
                    });
                    setStep(result.nextStep);
                  })
                }
              >
                Continue
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
                    setStep(result.nextStep);
                  })
                }
              >
                <SkipForward className="mr-1.5 h-4 w-4" />
                Skip
              </Button>
            </div>
          </section>
        ) : null}

        {step === 'assistant' && account ? (
          <section
            className="space-y-6"
            data-test="business-onboarding-assistant"
          >
            <header className="space-y-2">
              <h1 className="font-heading text-2xl font-semibold">
                Download Ozer Assistant
              </h1>
              <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                The Mac app records meetings, captures tasks, and stays in the
                menu bar. {OZER_ASSISTANT_DOWNLOAD.requirementsLabel}.
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
            <Button
              type="button"
              disabled={pending}
              className={cn(workspaceBtnPrimary, 'h-11 w-full')}
              onClick={() =>
                run(async () => {
                  const result = await continueBusinessAssistantAction({
                    accountId: account.id,
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

        {step === 'plan' && account ? (
          <section className="space-y-6" data-test="business-onboarding-plan">
            <header className="space-y-2">
              <h1 className="font-heading text-2xl font-semibold">
                Choose your plan
              </h1>
              <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                Free stays free — no card. Starter and Pro collect a card and
                start a 14-day trial.
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
