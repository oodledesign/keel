'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ArrowRight } from 'lucide-react';

import { useAppEvents } from '@kit/shared/events';
import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import {
  MARKETING_WORKSPACE_PLANS,
  buildPricingSignupUrl,
  formatGbp,
} from '~/lib/billing/pricing-marketing';
import { listBillingProductPlanPrices } from '~/lib/billing/billing-config-prices';
import { catalogPlansForAddonProduct } from '~/lib/billing/ozer-plan-catalog';
import {
  marketingBodyText,
  marketingBtnGradient,
  marketingBtnOutline,
  marketingFeatureCard,
  marketingMutedText,
} from '~/lib/marketing/marketing-ui';

type IntentAnswer = 'signatures' | 'freelance' | 'studio' | 'exploring';
type PeopleAnswer = 'solo' | 'team' | 'scale' | 'larger';
type SignatureAnswer = 'yes' | 'no';
type MailboxAnswer = 'starter' | 'team' | 'office' | 'custom';
type Step = 'intent' | 'mailboxes' | 'people' | 'signatures' | 'result';

type Answers = {
  intent?: IntentAnswer;
  people?: PeopleAnswer;
  signatures?: SignatureAnswer;
  mailboxes?: MailboxAnswer;
};

type Option<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

type SignatureTier = {
  key: Exclude<MailboxAnswer, 'custom'>;
  name: string;
  maxMailboxes: number;
  monthlyPlanId: string;
  annualPlanId: string;
  monthlyPriceGbp: number;
  yearlyPriceGbp: number;
};

type PlanRecommenderEvents = {
  'plan_recommender.answer': { question: string; answer: string };
  'plan_recommender.recommendation': { recommendation: string };
};

const SETUP_CALL_HREF =
  'mailto:info@ozer.so?subject=Signatures%20setup%20call';

const intentOptions: Array<Option<IntentAnswer>> = [
  { value: 'signatures', label: 'Just email signatures for my team' },
  { value: 'freelance', label: 'Running my freelance business' },
  { value: 'studio', label: 'Running a studio or small team' },
  { value: 'exploring', label: 'Exploring — not sure yet' },
];

const peopleOptions: Array<Option<PeopleAnswer>> = [
  { value: 'solo', label: 'Just me' },
  { value: 'team', label: '2–5' },
  { value: 'scale', label: '6–15' },
  { value: 'larger', label: '16 or more' },
];

const signatureOptions: Array<Option<SignatureAnswer>> = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No / maybe later' },
];

const mailboxOptions: Array<Option<MailboxAnswer>> = [
  { value: 'starter', label: 'Up to 10' },
  { value: 'team', label: '11–50' },
  { value: 'office', label: '51–150' },
  { value: 'custom', label: 'More than 150' },
];

export function PlanRecommender() {
  const appEvents = useAppEvents<PlanRecommenderEvents>();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState<Step>('intent');
  const [answers, setAnswers] = useState<Answers>({});

  const businessPlans = useMemo(() => {
    return MARKETING_WORKSPACE_PLANS.filter(
      (plan) => plan.profile === 'work_design',
    );
  }, []);

  const signatureTiers = useMemo(() => buildSignatureTiers(), []);
  const recommendation = useMemo(
    () => buildRecommendation(answers, businessPlans, signatureTiers),
    [answers, businessPlans, signatureTiers],
  );

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const goToStep = (nextStep: Step) => {
    setStep(nextStep);
  };

  const emitAnswer = (question: string, answer: string) => {
    appEvents.emit({
      type: 'plan_recommender.answer',
      payload: { question, answer },
    });
  };

  const emitRecommendation = (label: string) => {
    appEvents.emit({
      type: 'plan_recommender.recommendation',
      payload: { recommendation: label },
    });
  };

  const chooseIntent = (value: IntentAnswer) => {
    emitAnswer('intent', value);
    setAnswers({ intent: value });
    goToStep(value === 'signatures' ? 'mailboxes' : 'people');
  };

  const choosePeople = (value: PeopleAnswer) => {
    emitAnswer('people', value);
    setAnswers((current) => ({ ...current, people: value }));
    goToStep('signatures');
  };

  const chooseSignatures = (value: SignatureAnswer) => {
    emitAnswer('signatures', value);
    setAnswers((current) => {
      const next = {
        ...current,
        signatures: value,
        mailboxes: value === 'yes' ? current.mailboxes : undefined,
      };

      if (value === 'no') {
        const nextRecommendation = buildRecommendation(
          next,
          businessPlans,
          signatureTiers,
        );
        if (nextRecommendation) emitRecommendation(nextRecommendation.title);
      }

      return next;
    });
    goToStep(value === 'yes' ? 'mailboxes' : 'result');
  };

  const chooseMailboxes = (value: MailboxAnswer) => {
    emitAnswer('mailboxes', value);
    setAnswers((current) => {
      const next = { ...current, mailboxes: value };
      const nextRecommendation = buildRecommendation(
        next,
        businessPlans,
        signatureTiers,
      );
      if (nextRecommendation) emitRecommendation(nextRecommendation.title);
      return next;
    });
    goToStep('result');
  };

  const reset = () => {
    setAnswers({});
    goToStep('intent');
  };

  const back = () => {
    if (step === 'people') goToStep('intent');
    if (step === 'signatures') goToStep('people');
    if (step === 'mailboxes') {
      goToStep(answers.intent === 'signatures' ? 'intent' : 'signatures');
    }
    if (step === 'result') {
      if (answers.signatures === 'yes' || answers.intent === 'signatures') {
        goToStep('mailboxes');
      } else {
        goToStep('signatures');
      }
    }
  };

  return (
    <section
      className={cn(
        'rounded-3xl border border-[color:var(--workspace-shell-border)] p-5 md:p-8',
        marketingFeatureCard,
      )}
      aria-labelledby="plan-recommender-heading"
    >
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--ozer-coral-600)]">
          Plan finder
        </p>
        <h2
          id="plan-recommender-heading"
          ref={headingRef}
          tabIndex={-1}
          className="mt-2 font-heading text-2xl font-semibold text-[var(--workspace-shell-text)] outline-none md:text-3xl"
        >
          Not sure which plan? Answer three quick questions.
        </h2>
      </div>

      <ProgressDots step={step} answers={answers} />

      <div className="mx-auto mt-6 max-w-3xl">
        {step !== 'intent' ? (
          <button
            type="button"
            onClick={back}
            className="mb-4 text-sm font-medium text-[var(--ozer-coral-600)] underline underline-offset-2"
          >
            Back
          </button>
        ) : null}

        {step === 'intent' ? (
          <Question
            question="What are you here for?"
            options={intentOptions}
            onChoose={chooseIntent}
          />
        ) : null}

        {step === 'people' ? (
          <Question
            question="How many people will work in Ozer?"
            options={peopleOptions}
            onChoose={choosePeople}
          />
        ) : null}

        {step === 'signatures' ? (
          <Question
            question="Do you also want managed email signatures for the team?"
            options={signatureOptions}
            onChoose={chooseSignatures}
          />
        ) : null}

        {step === 'mailboxes' ? (
          <Question
            question="How many mailboxes need signatures?"
            options={mailboxOptions}
            onChoose={chooseMailboxes}
          />
        ) : null}

        {step === 'result' && recommendation ? (
          <RecommendationCard
            recommendation={recommendation}
            exploring={answers.intent === 'exploring'}
            onReset={reset}
          />
        ) : null}
      </div>
    </section>
  );
}

function Question<T extends string>({
  question,
  options,
  onChoose,
}: {
  question: string;
  options: Array<Option<T>>;
  onChoose: (value: T) => void;
}) {
  return (
    <div>
      <h3 className="font-heading text-xl font-semibold text-[var(--workspace-shell-text)]">
        {question}
      </h3>
      <div className="mt-4 grid gap-3">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChoose(option.value)}
            className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-5 py-4 text-left transition hover:border-[var(--ozer-accent)]/40 hover:bg-[var(--workspace-shell-sidebar-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ozer-accent)]"
          >
            <span className="block font-semibold text-[var(--workspace-shell-text)]">
              {option.label}
            </span>
            {option.description ? (
              <span className={cn('mt-1 block text-sm', marketingMutedText)}>
                {option.description}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProgressDots({ step, answers }: { step: Step; answers: Answers }) {
  const total = answers.intent === 'signatures' ? 2 : 4;
  const current =
    step === 'intent'
      ? 1
      : step === 'people'
        ? 2
        : step === 'signatures'
          ? 3
          : step === 'mailboxes' && answers.intent === 'signatures'
            ? 2
            : step === 'mailboxes'
              ? 4
              : total;

  return (
    <div className="mt-5 flex items-center justify-center gap-2" aria-hidden>
      {Array.from({ length: total }).map((_, index) => (
        <span
          key={index}
          className={cn(
            'h-2.5 w-2.5 rounded-full transition',
            index < current
              ? 'bg-[var(--ozer-accent)]'
              : 'bg-[var(--workspace-shell-border)]',
          )}
        />
      ))}
    </div>
  );
}

type Recommendation = {
  title: string;
  monthlyPriceGbp: number | null;
  yearlyPriceGbp: number | null;
  why: string;
  ctaLabel: string;
  ctaHref: string;
  note?: string;
};

function RecommendationCard({
  recommendation,
  exploring,
  onReset,
}: {
  recommendation: Recommendation;
  exploring: boolean;
  onReset: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--ozer-accent)]/35 bg-[var(--ozer-accent-subtle)] p-5 md:p-6">
      {exploring ? (
        <p className={cn('mb-4 text-sm', marketingBodyText)}>
          Personal and family workspaces are free forever — you can start there
          today and add a business workspace whenever you&apos;re ready.
        </p>
      ) : null}
      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--ozer-coral-600)]">
        Recommended
      </p>
      <h3 className="mt-2 font-heading text-2xl font-semibold text-[var(--workspace-shell-text)]">
        {recommendation.title}
      </h3>
      {recommendation.monthlyPriceGbp == null ? (
        <p className="mt-4 text-3xl font-bold text-[var(--workspace-shell-text)]">
          Talk to us
        </p>
      ) : (
        <>
          <p className="mt-4 text-3xl font-bold text-[var(--workspace-shell-text)]">
            {formatGbp(recommendation.monthlyPriceGbp)}
            <span className={cn('text-base font-normal', marketingMutedText)}>
              /mo
            </span>
          </p>
          {recommendation.yearlyPriceGbp != null &&
          recommendation.yearlyPriceGbp > 0 ? (
            <p className={cn('mt-1 text-sm', marketingMutedText)}>
              or {formatGbp(recommendation.yearlyPriceGbp)} per year — 16.7%
              less than monthly
            </p>
          ) : null}
        </>
      )}
      <p className={cn('mt-4 text-sm leading-relaxed', marketingBodyText)}>
        {recommendation.why}
      </p>
      {recommendation.note ? (
        <p className={cn('mt-2 text-sm', marketingMutedText)}>
          {recommendation.note}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button asChild className={marketingBtnGradient}>
          <Link href={recommendation.ctaHref}>
            {recommendation.ctaLabel}
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          className={marketingBtnOutline}
          onClick={onReset}
        >
          Change my answers
        </Button>
      </div>
    </div>
  );
}

function buildRecommendation(
  answers: Answers,
  businessPlans: typeof MARKETING_WORKSPACE_PLANS,
  signatureTiers: SignatureTier[],
): Recommendation | null {
  const signatureTier = getSignatureTier(answers.mailboxes, signatureTiers);
  const signaturesOnly = answers.intent === 'signatures';
  const businessPlan = signaturesOnly
    ? getBusinessPlan('lite', businessPlans)
    : getBusinessPlan(answers.people, businessPlans);

  if (!businessPlan && !signaturesOnly) return null;

  const customSignatures = answers.mailboxes === 'custom';
  const includeSignatures =
    signaturesOnly || answers.signatures === 'yes' || customSignatures;

  if (signaturesOnly && !answers.mailboxes) return null;
  if (!signaturesOnly && includeSignatures && !answers.mailboxes) return null;

  if (customSignatures) {
    return {
      title: signaturesOnly
        ? 'Business Lite (free) + Signatures custom'
        : `${businessPlan?.name ?? 'Business Scale'} + Signatures custom`,
      monthlyPriceGbp: signaturesOnly ? 0 : (businessPlan?.monthlyPriceGbp ?? null),
      yearlyPriceGbp: signaturesOnly ? 0 : (businessPlan?.yearlyPriceGbp ?? null),
      why: signaturesOnly
        ? 'Business Lite keeps the workspace free forever while we set a custom flat Signatures tier for your mailbox count.'
        : `${businessPlan?.name ?? 'Business Scale'} covers your team workspace, and we will sort a custom flat Signatures tier for your mailbox count.`,
      note: 'For teams past 150 mailboxes, book a setup call and we will sort seats and pricing.',
      ctaLabel: 'Book a setup call',
      ctaHref: SETUP_CALL_HREF,
    };
  }

  const monthly =
    (businessPlan?.monthlyPriceGbp ?? 0) +
    (includeSignatures ? (signatureTier?.monthlyPriceGbp ?? 0) : 0);
  const yearly =
    (businessPlan?.yearlyPriceGbp ?? 0) +
    (includeSignatures ? (signatureTier?.yearlyPriceGbp ?? 0) : 0);

  const names = [
    signaturesOnly ? 'Business Lite (free)' : businessPlan?.name,
    includeSignatures && signatureTier
      ? `Signatures ${signatureTier.name}`
      : null,
  ].filter(Boolean);

  return {
    title: names.join(' + '),
    monthlyPriceGbp: monthly,
    yearlyPriceGbp: yearly,
    why: buildWhy(answers, businessPlan, signatureTier, signaturesOnly),
    note:
      answers.people === 'larger'
        ? "For teams past 15, book a call and we'll sort seats and pricing."
        : signaturesOnly
          ? 'The Business Lite workspace itself is free forever.'
          : undefined,
    ctaLabel: 'Start free',
    ctaHref: buildPricingSignupUrl(
      signaturesOnly
        ? {
            profile: 'work_design',
            productId: 'ozer-business-lite',
            planId: 'business-lite-free',
          }
        : {
            profile: 'work_design',
            productId: businessPlan?.productId,
            planId: businessPlan?.monthlyPlanId,
            interval: 'month',
          },
    ),
  };
}

function buildWhy(
  answers: Answers,
  businessPlan: (typeof MARKETING_WORKSPACE_PLANS)[number] | undefined,
  signatureTier: SignatureTier | undefined,
  signaturesOnly: boolean,
) {
  if (signaturesOnly && signatureTier) {
    return `${signatureTier.name} covers ${mailboxBandText(signatureTier)} with centrally managed signatures — flat, never per person.`;
  }

  const businessWhy =
    businessPlan?.productId === 'ozer-business-solo'
      ? 'Solo covers one freelancer with clients, projects, and invoices — flat, no per-seat maths.'
      : businessPlan?.productId === 'ozer-business-team'
        ? 'Team covers up to 5 people with shared clients and projects — flat, no per-seat maths.'
        : 'Scale covers up to 15 people with shared clients, projects, and priority support — flat, no per-seat maths.';

  if (answers.signatures === 'yes' && signatureTier) {
    return `${businessWhy} Signatures ${signatureTier.name} adds ${mailboxBandText(signatureTier)}.`;
  }

  return businessWhy;
}

function buildSignatureTiers(): SignatureTier[] {
  const planPrices = listBillingProductPlanPrices('ozer-addon-signatures');
  const priceByPlanId = new Map(planPrices.map((plan) => [plan.planId, plan]));

  return catalogPlansForAddonProduct('ozer-addon-signatures')
    .filter((plan) => plan.planId.endsWith('-monthly'))
    .map((plan) => {
      const annualPlanId = plan.planId.replace('-monthly', '-yearly');
      const monthly = priceByPlanId.get(plan.planId);
      const annual = priceByPlanId.get(annualPlanId);
      const name = tierName(monthly?.planName ?? plan.planId);
      const maxMailboxes = plan.limits.maxMailboxes;

      if (!maxMailboxes) return null;

      return {
        key:
          maxMailboxes <= 10
            ? 'starter'
            : maxMailboxes <= 50
              ? 'team'
              : 'office',
        name,
        maxMailboxes,
        monthlyPlanId: plan.planId,
        annualPlanId,
        monthlyPriceGbp: monthly?.priceGbp ?? 0,
        yearlyPriceGbp: annual?.priceGbp ?? 0,
      } satisfies SignatureTier;
    })
    .filter((tier): tier is SignatureTier => Boolean(tier))
    .sort((a, b) => a.maxMailboxes - b.maxMailboxes);
}

function getSignatureTier(
  answer: MailboxAnswer | undefined,
  tiers: SignatureTier[],
) {
  if (!answer || answer === 'custom') return undefined;
  return tiers.find((tier) => tier.key === answer);
}

function getBusinessPlan(
  answer: PeopleAnswer | 'lite' | undefined,
  plans: typeof MARKETING_WORKSPACE_PLANS,
) {
  if (answer === 'lite') {
    return plans.find((plan) => plan.productId === 'ozer-business-lite');
  }
  if (answer === 'solo') {
    return plans.find((plan) => plan.maxTeamMembers === 1);
  }
  if (answer === 'team') {
    return plans.find((plan) => plan.maxTeamMembers === 5);
  }
  if (answer === 'scale' || answer === 'larger') {
    return plans.find((plan) => plan.maxTeamMembers === 15);
  }
  return undefined;
}

function tierName(planName: string) {
  return planName
    .replace(/^Signatures\s+/i, '')
    .replace(/\s+(Monthly|Annual)$/i, '')
    .trim();
}

function mailboxBandText(tier: SignatureTier) {
  if (tier.maxMailboxes <= 10) return 'up to 10 mailboxes';
  if (tier.maxMailboxes <= 50) return '11–50 mailboxes';
  return '51–150 mailboxes';
}
