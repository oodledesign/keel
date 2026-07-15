'use client';

import Link from 'next/link';

import { ArrowRight, CheckCircle2, ExternalLink } from 'lucide-react';

import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';
import type { WebsiteBriefStackPreference } from '~/lib/websites/brief-types';
import type { WebsiteBrief } from '~/lib/websites/planning-types';

const STACK_PREF_LABELS: Record<WebsiteBriefStackPreference, string> = {
  webflow: 'Webflow',
  astro: 'Astro',
  next: 'Next.js',
  ozer_sites: 'Ozer Sites',
  undecided: 'Undecided',
};

const LAUNCH_CHECKS = [
  'All sitemap pages built',
  'Content matches approved docs',
  'Meta titles/descriptions + JSON-LD in place',
  'llms.txt deployed (if used)',
  'Mobile checked on key breakpoints',
  'Staging URL shared with client',
  'Website record updated: domain, stack, repo links',
] as const;

export function WebsiteBuildPanel({
  accountSlug,
  websiteId,
  domain,
  stagingUrl,
  stack,
  githubRepoUrl,
  stackPreference,
  hasOzerSite,
  canEdit,
  onOpenExport,
  onOpenSite,
}: {
  accountSlug: string;
  websiteId: string;
  domain: string | null;
  stagingUrl: string | null;
  stack: string | null;
  githubRepoUrl: string | null;
  stackPreference: WebsiteBrief['stackPreference'] | null | undefined;
  hasOzerSite: boolean;
  canEdit: boolean;
  onOpenExport: () => void;
  onOpenSite: () => void;
}) {
  const editHref = pathsConfig.app.accountWebsiteEdit
    .replace('[account]', accountSlug)
    .replace('[id]', websiteId);

  const preferOzer = hasOzerSite || stackPreference === 'ozer_sites';
  const stackLabel =
    stack?.trim() ||
    (stackPreference ? STACK_PREF_LABELS[stackPreference] : null) ||
    '—';

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-[var(--workspace-shell-text)]">
          Build
        </h3>
        <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
          Implement from the export pack — use visual references and real
          content, not text-only prompts.
        </p>
      </div>

      <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
        <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
          Prerequisites
        </p>
        <ul className="mt-2 space-y-1.5 text-sm text-[var(--workspace-shell-text-muted)]">
          <li>Sitemap + wireframes approved</li>
          <li>Style tokens locked</li>
          <li>Search fields filled for key pages</li>
          <li>Export pack generated</li>
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={onOpenExport}>
            Open Export
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[color:var(--workspace-shell-border)] p-4">
          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
            Build with AI (Cursor / Claude)
          </p>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            Feed the prompt pack into Cursor. Paste real client content per
            section before generating. Match library components from the export.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={onOpenExport}
          >
            Get prompt pack
          </Button>
        </div>

        <div className="rounded-xl border border-[color:var(--workspace-shell-border)] p-4">
          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
            {preferOzer ? 'Build in Ozer Sites' : 'Hosted build (Ozer Sites)'}
          </p>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            {preferOzer
              ? 'Publish pages with the Puck editor — no external host required.'
              : 'Prefer building in Webflow or a code starter? Use Export. Or switch the brief stack to Ozer Sites to publish here.'}
          </p>
          <Button
            type="button"
            size="sm"
            variant={preferOzer ? 'default' : 'outline'}
            className="mt-3"
            onClick={onOpenSite}
          >
            Open Site
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-[color:var(--workspace-shell-border)] p-4">
        <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
          Launch checklist
        </p>
        <ul className="mt-3 space-y-2">
          {LAUNCH_CHECKS.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2 text-sm text-[var(--workspace-shell-text-muted)]"
            >
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--workspace-shell-text)]/30"
                aria-hidden
              />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-[color:var(--workspace-shell-border)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
              Website record
            </p>
            <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
              Keep domain, staging, stack, and repo links up to date for
              hand-off and care.
            </p>
          </div>
          {canEdit ? (
            <Link
              href={editHref}
              className="inline-flex items-center gap-1.5 text-sm text-[var(--ozer-accent)] hover:underline"
            >
              Edit website
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs tracking-wide text-[var(--workspace-shell-text)]/40 uppercase">
              Domain
            </dt>
            <dd className="mt-0.5 text-sm text-[var(--workspace-shell-text)]">
              {domain?.trim() || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs tracking-wide text-[var(--workspace-shell-text)]/40 uppercase">
              Staging
            </dt>
            <dd className="mt-0.5 text-sm text-[var(--workspace-shell-text)]">
              {stagingUrl?.trim() || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs tracking-wide text-[var(--workspace-shell-text)]/40 uppercase">
              Stack
            </dt>
            <dd className="mt-0.5 text-sm text-[var(--workspace-shell-text)]">
              {stackLabel}
            </dd>
          </div>
          <div>
            <dt className="text-xs tracking-wide text-[var(--workspace-shell-text)]/40 uppercase">
              Repo
            </dt>
            <dd className="mt-0.5 text-sm text-[var(--workspace-shell-text)]">
              {githubRepoUrl?.trim() || '—'}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
