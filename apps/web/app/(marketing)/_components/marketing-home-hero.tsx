'use client';

import Link from 'next/link';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, CheckCircle2, LayoutDashboard } from 'lucide-react';

import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';

const FEATURE_CHIPS = [
  'Clients',
  'Projects',
  'Invoicing',
  'Email',
  'Planner',
  'Notes',
  'Pipeline',
] as const;

const TODAY_TASKS = [
  { time: '09:00', text: 'School run prep', tag: 'Personal', color: '#7C3AED' },
  { time: '10:30', text: 'Review Acme proposal', tag: 'Business', color: '#2563EB' },
  { time: '12:00', text: 'Send invoice #047', tag: 'Business', color: '#2563EB' },
  { time: '15:00', text: 'Community event notes', tag: 'Community', color: '#2A9D8F' },
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
      <div className="grid items-center gap-12 lg:grid-cols-[1.05fr,0.95fr]">
        <div className="space-y-8">
          <span className="inline-flex items-center rounded-full border border-violet-300/20 bg-violet-500/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-violet-200">
            Built for people who do it all
          </span>

          <div className="space-y-5">
            <motion.h1
              className="font-heading text-4xl font-bold leading-tight text-white md:text-6xl"
              {...fadeUpProps(0, 0.5)}
            >
              The one system built for every part of your life.
            </motion.h1>

            <motion.p
              className="max-w-xl text-base leading-relaxed text-violet-100/85 md:text-lg"
              {...fadeUpProps(0.1, 0.5)}
            >
              Your agency, your family, your personal life — each in its own workspace.
              But one home that sees across all of them. No more switching between apps
              to feel like you&apos;ve got it together.
            </motion.p>

            <motion.div
              className="flex flex-wrap gap-2"
              {...(reducedMotion
                ? {}
                : {
                    initial: { opacity: 0 },
                    animate: { opacity: 1 },
                    transition: { duration: 0.3, delay: 0.15 },
                  })}
            >
              {FEATURE_CHIPS.map((chip, index) => (
                <motion.span
                  key={chip}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-wide text-slate-300"
                  {...(reducedMotion
                    ? {}
                    : {
                        initial: { opacity: 0, y: 8 },
                        animate: { opacity: 1, y: 0 },
                        transition: { duration: 0.3, delay: index * 0.05 },
                      })}
                >
                  {chip}
                </motion.span>
              ))}
            </motion.div>
          </div>

          <motion.div
            className="flex flex-wrap items-center gap-3"
            {...fadeUpProps(0.3, 0.5)}
          >
            <Button
              asChild
              size="lg"
              className="h-11 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 text-white hover:from-violet-400 hover:to-fuchsia-400"
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
              className="h-11 rounded-full border-violet-300/25 bg-[#100d1f]/70 px-6 text-violet-100 hover:bg-[#17122e]"
            >
              <Link href="/pricing">View pricing</Link>
            </Button>
          </motion.div>
        </div>

        <motion.div
          className="relative rounded-3xl border border-violet-300/15 bg-[#0f0d1e]/85 p-5 shadow-[0_30px_100px_rgba(23,8,50,0.55)] backdrop-blur"
          {...(reducedMotion
            ? {}
            : {
                initial: { opacity: 0, y: 32, scale: 0.97 },
                animate: { opacity: 1, y: 0, scale: 1 },
                transition: { duration: 0.6, delay: 0.4, ease: 'easeOut' },
              })}
        >
          <div className="absolute -inset-px rounded-3xl bg-[linear-gradient(135deg,rgba(167,139,250,0.35),rgba(236,72,153,0.18),transparent_58%)] opacity-70" />
          <div className="relative rounded-2xl border border-white/10 bg-[#120f24] p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.12em] text-violet-200/80">
                Today in Ozer
              </p>
              <LayoutDashboard className="h-4 w-4 text-violet-200/80" />
            </div>
            <div className="space-y-3">
              {TODAY_TASKS.map((item) => (
                <div
                  key={`${item.time}-${item.text}`}
                  className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-violet-50/90">
                      <span className="font-mono text-xs text-violet-300/70">
                        {item.time}
                      </span>{' '}
                      {item.text}
                    </p>
                    <span className="mt-1 inline-flex items-center gap-1 rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/70">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      {item.tag}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      <motion.p
        className="mb-4 mt-8 text-center text-sm text-slate-400"
        {...(reducedMotion
          ? {}
          : {
              initial: { opacity: 0 },
              animate: { opacity: 1 },
              transition: { duration: 0.5, delay: 0.5, ease: 'easeOut' },
            })}
      >
        Designed by a freelancer, for freelancers and small agencies.
      </motion.p>
    </>
  );
}
