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
  marketingHeadlineGradient,
  marketingHeroChip,
  marketingHeroEase,
  marketingMutedText,
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
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

export function MarketingHomeHero() {
  const reducedMotion = useReducedMotion() ?? false;

  const fadeUpProps = (delay = 0, duration = 0.4) =>
    reducedMotion
      ? {}
      : {
          initial: fadeUp.initial,
          animate: fadeUp.animate,
          transition: { duration, delay, ease: marketingHeroEase },
        };

  return (
    <>
      <div className="mx-auto max-w-[46rem] text-center">
        <motion.span className={marketingEyebrow} {...fadeUpProps(0, 0.38)}>
          Built for people who do it all
        </motion.span>

        <div className="mt-8 space-y-6 md:mt-10">
          <motion.h1
            className="font-heading text-[2.625rem] font-bold leading-[1.06] tracking-[-0.02em] text-[var(--workspace-shell-text)] md:text-6xl lg:text-[4.5rem]"
            {...fadeUpProps(0.06, 0.42)}
          >
            The one system built for{' '}
            <span className={marketingHeadlineGradient}>every part of your life</span>.
          </motion.h1>

          <motion.p
            className={`mx-auto max-w-[34rem] text-base leading-[1.65] md:text-lg md:leading-[1.7] ${marketingMutedText}`}
            {...fadeUpProps(0.14, 0.38)}
          >
            Your agency, your family, your personal life — each in its own workspace.
            One home that sees across all of them, with Meeting Assistant ready at launch
            and AI planner built in from day one.
          </motion.p>

          <motion.div
            className="flex flex-wrap justify-center gap-2.5 px-1"
            {...(reducedMotion
              ? {}
              : {
                  initial: { opacity: 0 },
                  animate: { opacity: 1 },
                  transition: { duration: 0.28, delay: 0.2, ease: marketingHeroEase },
                })}
          >
            {FEATURE_CHIPS.map((chip, index) => (
              <motion.span
                key={chip}
                className={marketingHeroChip}
                {...(reducedMotion
                  ? {}
                  : {
                      initial: { opacity: 0, y: 6 },
                      animate: { opacity: 1, y: 0 },
                      transition: {
                        duration: 0.32,
                        delay: 0.22 + index * 0.05,
                        ease: marketingHeroEase,
                      },
                    })}
              >
                {chip}
              </motion.span>
            ))}
          </motion.div>
        </div>

        <motion.div
          className="mt-10 flex flex-wrap items-center justify-center gap-3 md:mt-12"
          {...fadeUpProps(0.32, 0.38)}
        >
          <Button asChild size="lg" className={marketingBtnGradient}>
            <Link href={pathsConfig.auth.signUp}>
              Start free
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className={marketingBtnOutline}>
            <Link href="/pricing">View pricing</Link>
          </Button>
        </motion.div>

        <motion.p
          className={`mt-5 text-sm ${marketingMutedText}`}
          {...fadeUpProps(0.4, 0.32)}
        >
          Designed by a freelancer, for freelancers and small agencies.
        </motion.p>
      </div>

      <MarketingHeroShowcaseCarousel />
    </>
  );
}
