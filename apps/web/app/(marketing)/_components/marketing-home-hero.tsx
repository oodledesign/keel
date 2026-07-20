'use client';

import Link from 'next/link';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

import { Button } from '@kit/ui/button';

import { MARKETING_FREE_SIGNUP_URL } from '~/lib/billing/pricing-marketing';
import {
  marketingBtnGradient,
  marketingBtnOutline,
  marketingEyebrow,
  marketingHeadlineGradient,
  marketingHeroEase,
  marketingMutedText,
} from '~/lib/marketing/marketing-ui';
import type { MarketingViewerContext } from '~/lib/marketing/marketing-viewer';

import { MarketingHeroConnectionMap } from './marketing-hero-connection-map';

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

type MarketingHomeHeroProps = {
  viewer: MarketingViewerContext;
};

export function MarketingHomeHero({ viewer }: MarketingHomeHeroProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const { isAuthenticated, dashboardHref } = viewer;

  // Always render the same initial markup on server and client (avoids a
  // hydration mismatch for reduced-motion users); collapse the animation to
  // zero duration instead of removing it.
  const fadeUpProps = (delay = 0, duration = 0.4) => ({
    initial: fadeUp.initial,
    animate: fadeUp.animate,
    transition: reducedMotion
      ? { duration: 0, delay: 0 }
      : { duration, delay, ease: marketingHeroEase },
  });

  return (
    <>
      <div className="mx-auto max-w-[46rem] text-center">
        <motion.span className={marketingEyebrow} {...fadeUpProps(0, 0.38)}>
          {isAuthenticated
            ? 'Welcome back to your workspace'
            : 'For freelancers & small studios'}
        </motion.span>

        <div className="mt-6 space-y-5 md:mt-8">
          <motion.h1
            className="font-heading text-[2.625rem] leading-[1.06] font-bold tracking-[-0.02em] text-[var(--workspace-shell-text)] md:text-6xl lg:text-[4.5rem]"
            {...fadeUpProps(0.06, 0.42)}
          >
            {isAuthenticated ? (
              <>
                Pick up where you{' '}
                <span className={marketingHeadlineGradient}>left off</span>
              </>
            ) : (
              <>
                Run your studio from{' '}
                <span className={marketingHeadlineGradient}>one home</span>
              </>
            )}
          </motion.h1>

          <motion.p
            className={`mx-auto max-w-[34rem] text-base leading-[1.65] md:text-lg md:leading-[1.7] ${marketingMutedText}`}
            {...fadeUpProps(0.14, 0.38)}
          >
            {isAuthenticated
              ? 'Your clients, projects, invoices, and plan for the day are ready in your personal hub — one login, every workspace.'
              : 'Clients, projects, invoices, pipeline, activity tracking, and your plan for the day — one place, one login. From £29/month flat, with no per-seat maths and no transaction fees.'}
          </motion.p>
        </div>

        <motion.div
          className="mt-8 flex flex-wrap items-center justify-center gap-3 md:mt-9"
          {...fadeUpProps(0.24, 0.38)}
        >
          {isAuthenticated ? (
            <Button asChild size="lg" className={marketingBtnGradient}>
              <Link href={dashboardHref}>
                Open your workspace
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button asChild size="lg" className={marketingBtnGradient}>
              <Link href={MARKETING_FREE_SIGNUP_URL}>
                Start free
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          )}
          <Button
            asChild
            variant="outline"
            size="lg"
            className={marketingBtnOutline}
          >
            <Link href="/pricing">See pricing</Link>
          </Button>
        </motion.div>

        <motion.p
          className={`mt-4 text-sm ${marketingMutedText}`}
          {...fadeUpProps(0.32, 0.32)}
        >
          {isAuthenticated
            ? 'Personal and family workspaces stay free forever'
            : 'Free forever · optional workspaces after signup'}
        </motion.p>
      </div>

      <MarketingHeroConnectionMap viewer={viewer} />
    </>
  );
}
