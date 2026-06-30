'use client';

import Link from 'next/link';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';
import {
  marketingBtnGradient,
  marketingBtnOutline,
  marketingEyebrow,
} from '~/lib/marketing/marketing-ui';

import { MarketingHeroShowcaseCarousel } from './marketing-hero-showcase-carousel';

const FEATURE_CHIPS = [
  'Clients',
  'Projects',
  'Invoicing',
  'Email',
  'Planner',
  'Second Brain',
  'Meeting Assistant',
  'Notes',
  'Pipeline',
] as const;

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export function MarketingHomeHero() {
  const reducedMotion = useReducedMotion() ?? false;

  const fadeUpProps = (delay = 0, duration = 0.5) =>
    reducedMotion
      ? {}
      : {
          initial: fadeUp.initial,
          animate: fadeUp.animate,
          transition: { duration, delay, ease: 'easeOut' as const },
        };

  return (
    <>
      <div className="mx-auto max-w-4xl text-center">
        <motion.span
          className={marketingEyebrow}
          {...fadeUpProps(0, 0.45)}
        >
          Built for people who do it all
        </motion.span>

        <div className="mt-6 space-y-5">
          <motion.h1
            className="font-heading text-4xl font-bold leading-[1.08] tracking-tight text-[var(--workspace-shell-text)] md:text-6xl lg:text-[4.25rem]"
            {...fadeUpProps(0.05, 0.5)}
          >
            The one system built for every part of your life.
          </motion.h1>

          <motion.p
            className="mx-auto max-w-2xl text-base leading-relaxed text-[var(--workspace-shell-text-muted)] md:text-lg"
            {...fadeUpProps(0.12, 0.5)}
          >
            Your agency, your family, your personal life — each in its own workspace.
            One home that sees across all of them, with Meeting Assistant ready at launch
            and AI planner built in from day one.
          </motion.p>

          <motion.div
            className="flex flex-wrap justify-center gap-2"
            {...(reducedMotion
              ? {}
              : {
                  initial: { opacity: 0 },
                  animate: { opacity: 1 },
                  transition: { duration: 0.3, delay: 0.18 },
                })}
          >
            {FEATURE_CHIPS.map((chip, index) => (
              <motion.span
                key={chip}
                className="rounded-full border border-[color:var(--workspace-shell-border)] px-3 py-1 text-xs uppercase tracking-wide text-[var(--workspace-shell-text-muted)]"
                {...(reducedMotion
                  ? {}
                  : {
                      initial: { opacity: 0, y: 8 },
                      animate: { opacity: 1, y: 0 },
                      transition: { duration: 0.3, delay: 0.2 + index * 0.04 },
                    })}
              >
                {chip}
              </motion.span>
            ))}
          </motion.div>
        </div>

        <motion.div
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
          {...fadeUpProps(0.28, 0.5)}
        >
          <Button
            asChild
            size="lg"
            className={marketingBtnGradient}
          >
            <Link href={pathsConfig.auth.signUp}>
              Start free
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className={marketingBtnOutline}
          >
            <Link href="/pricing">View pricing</Link>
          </Button>
        </motion.div>

        <motion.p
          className="mt-6 text-sm text-[var(--workspace-shell-text-muted)]"
          {...fadeUpProps(0.36, 0.5)}
        >
          Designed by a freelancer, for freelancers and small agencies.
        </motion.p>
      </div>

      <MarketingHeroShowcaseCarousel />
    </>
  );
}
