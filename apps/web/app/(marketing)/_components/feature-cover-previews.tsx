import Image from 'next/image';

import {
  BarChart3,
  Brain,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  CreditCard,
  FileSignature,
  FileText,
  FolderKanban,
  Kanban,
  Keyboard,
  LayoutDashboard,
  ListChecks,
  Mail,
  MessageSquare,
  Mic,
  RefreshCw,
  Search,
  Sparkles,
  StickyNote,
  Sun,
  Users,
} from 'lucide-react';

import { cn } from '@kit/ui/utils';

import type { FeatureSlug } from '~/lib/marketing/feature-landing-pages';

type FeatureCoverPreviewProps = {
  slug: FeatureSlug;
  variant?: 'hero' | 'card';
  className?: string;
};

export function FeatureCoverPreview({
  slug,
  variant = 'hero',
  className,
}: FeatureCoverPreviewProps) {
  const isCard = variant === 'card';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-plum-950)] shadow-[0_12px_40px_var(--ozer-plum-alpha-18)]',
        isCard ? 'aspect-[16/10]' : 'min-h-[220px] md:min-h-[280px]',
        className,
      )}
    >
      <div
        className={cn(
          'absolute inset-0',
          isCard ? 'scale-[0.92] origin-top' : 'p-1 md:p-2',
        )}
      >
        {renderCover(slug, isCard)}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-[var(--ozer-plum-950)]" />
    </div>
  );
}

function renderCover(slug: FeatureSlug, compact: boolean) {
  switch (slug) {
    case 'planner':
      return <PlannerCover compact={compact} />;
    case 'email-assistant':
      return <EmailCover compact={compact} />;
    case 'desktop-assistant':
      return <DesktopAssistantCover compact={compact} />;
    case 'dictation':
      return <DictationCover compact={compact} />;
    case 'client-portals':
      return <ClientPortalsCover compact={compact} />;
    case 'invoicing':
      return <InvoicingCover compact={compact} />;
    case 'second-brain':
      return <SecondBrainCover compact={compact} />;
    case 'messaging':
      return <MessagingCover compact={compact} />;
    case 'notes':
      return <NotesCover compact={compact} />;
    case 'pipeline':
      return <PipelineCover compact={compact} />;
    case 'project-management':
      return <ProjectManagementCover compact={compact} />;
    case 'tasks':
      return <TasksCover compact={compact} />;
    case 'contracts':
      return <ContractsCover compact={compact} />;
    case 'sops':
      return <SopsCover compact={compact} />;
    case 'finances':
      return <FinancesCover compact={compact} />;
    default:
      return null;
  }
}

function PlannerCover({ compact }: { compact: boolean }) {
  return (
    <div className="flex h-full flex-col rounded-[1.25rem] bg-[var(--ozer-lime-100)] p-4 text-[var(--ozer-text-on-light)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-[var(--ozer-plum-900)]" />
          <p className={cn('font-semibold', compact ? 'text-xs' : 'text-sm')}>
            Today&apos;s plan
          </p>
        </div>
        <Sun className="h-4 w-4 text-[var(--ozer-accent)]" />
      </div>
      <div className="mt-3 space-y-2">
        {[
          { time: '09:00', task: 'Deep work — Acme proposal', done: true },
          { time: '11:30', task: 'Client call prep', done: false },
          { time: '14:00', task: 'Review portal feedback', done: false },
        ].map((row) => (
          <div
            key={row.task}
            className="flex items-center gap-2 rounded-xl bg-[var(--ozer-white)] px-3 py-2"
          >
            {row.done ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[var(--ozer-accent)]" />
            ) : (
              <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-[var(--ozer-accent)]" />
            )}
            <div className="min-w-0">
              <p className="font-mono text-[10px] text-[var(--ozer-text-on-light-muted)]">{row.time}</p>
              <p className={cn('truncate font-medium', compact ? 'text-[11px]' : 'text-xs')}>
                {row.task}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmailCover({ compact }: { compact: boolean }) {
  return (
    <div className="flex h-full flex-col rounded-[1.25rem] border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-plum-950)] p-4">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-[var(--ozer-coral-400)]" />
        <p className={cn('font-semibold text-[var(--ozer-text-on-dark)]', compact ? 'text-xs' : 'text-sm')}>
          Inbox with context
        </p>
      </div>
      <div className="mt-3 space-y-2">
        {[
          { client: 'Acme Co', subject: 'Re: March deliverables', tag: '2 action items' },
          { client: 'North Lane', subject: 'Invoice question', tag: 'Draft ready' },
        ].map((row) => (
          <div
            key={row.subject}
            className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 py-2"
          >
            <p className="text-[10px] font-semibold text-[var(--ozer-lime-400)]">{row.client}</p>
            <p className={cn('text-[var(--ozer-text-on-dark)]/90', compact ? 'text-[11px]' : 'text-xs')}>
              {row.subject}
            </p>
            <span className="mt-1 inline-block rounded-md border border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-plum-800)] px-1.5 py-0.5 text-[9px] text-[var(--ozer-lime-400)]">
              {row.tag}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-auto flex items-center gap-1.5 pt-2 text-[9px] text-[var(--ozer-text-on-dark-muted)]">
        <Sparkles className="h-3 w-3" />
        AI draft with project context
      </div>
    </div>
  );
}

function DesktopAssistantCover({ compact }: { compact: boolean }) {
  return (
    <div className="flex h-full flex-col rounded-[1.25rem] border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-plum-950)] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--ozer-accent-subtle)]">
            <Mic className="h-3.5 w-3.5 text-[var(--ozer-coral-400)]" />
          </span>
          <div>
            <p className={cn('font-semibold text-[var(--ozer-text-on-dark)]', compact ? 'text-xs' : 'text-sm')}>
              Client kickoff
            </p>
            <p className="text-[10px] text-[var(--ozer-text-on-dark-muted)]">Ozer Assistant · macOS</p>
          </div>
        </div>
        <span className="rounded-full bg-[var(--ozer-accent)] px-2 py-0.5 text-[9px] font-medium text-[var(--ozer-plum-950)]">
          Recording
        </span>
      </div>
      <div className="mt-3 grid flex-1 gap-2 md:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--ozer-coral-400)]/70">
            Transcript
          </p>
          {[
            { speaker: 'You', text: 'Phase one scope by Friday…' },
            { speaker: 'Client', text: 'Can we add the portal mockups?' },
          ].map((line) => (
            <div
              key={line.speaker}
              className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-2 py-1.5"
            >
              <p className="text-[9px] font-semibold text-[var(--ozer-coral-400)]/80">{line.speaker}</p>
              <p className="truncate text-[10px] text-[var(--ozer-text-on-dark)]/85">{line.text}</p>
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--ozer-lime-400)]">
            Tasks
          </p>
          {[
            'Send proposal by Friday',
            'Add portal mockups to scope',
            'Schedule follow-up call',
          ].map((task) => (
            <div
              key={task}
              className="flex items-start gap-1.5 rounded-lg border border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-plum-800)] px-2 py-1.5"
            >
              <CheckSquare className="mt-0.5 h-3 w-3 shrink-0 text-[var(--ozer-lime-400)]" />
              <p className="text-[10px] leading-snug text-[var(--ozer-text-on-dark)]">{task}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DictationCover({ compact }: { compact: boolean }) {
  return (
    <div className="flex h-full flex-col rounded-[1.25rem] border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-plum-900)] p-4">
      <div className="flex items-center gap-2">
        <Keyboard className="h-4 w-4 text-sky-300" />
        <p className={cn('font-semibold text-[var(--ozer-text-on-dark)]', compact ? 'text-xs' : 'text-sm')}>
          Dictation
        </p>
        <span className="ml-auto rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--workspace-shell-text)]/60">
          fn
        </span>
      </div>
      <div className="mt-3 flex-1 rounded-xl border border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-plum-800)] p-3">
        <p className="text-[10px] text-[var(--ozer-text-on-dark-muted)]">Speaking into any app…</p>
        <p className={cn('mt-2 leading-relaxed text-[var(--ozer-text-on-dark)]/95', compact ? 'text-[11px]' : 'text-xs')}>
          Hi Sarah — thanks for the brief. I&apos;ll send the updated proposal by
          Friday with the portal mockups included.
        </p>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {['Punctuation', 'Grammar', 'Paste anywhere'].map((tag) => (
          <span
            key={tag}
            className="rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-1.5 py-0.5 text-[9px] text-sky-100/75"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function ClientPortalsCover({ compact }: { compact: boolean }) {
  return (
    <div className="flex h-full flex-col rounded-[1.25rem] bg-[var(--ozer-sky-100)] p-4 text-[var(--ozer-text-on-light)]">
      <div className="flex items-center gap-2">
        <LayoutDashboard className="h-4 w-4 text-[var(--ozer-slate-blue)]" />
        <p className={cn('font-semibold', compact ? 'text-xs' : 'text-sm')}>
          Acme client portal
        </p>
      </div>
      <div className="mt-3 grid flex-1 grid-cols-2 gap-2">
        {['Brand guidelines.pdf', 'Homepage v3', 'Invoice #1042'].map((item) => (
          <div
            key={item}
            className="rounded-xl border border-[color:var(--ozer-border-on-light)] bg-[var(--ozer-white)] px-2.5 py-2"
          >
            <p className={cn('font-medium', compact ? 'text-[10px]' : 'text-xs')}>{item}</p>
            <p className="mt-1 text-[9px] text-[var(--ozer-slate-blue)]/70">Ready for review</p>
          </div>
        ))}
        <div className="rounded-xl border border-[color:var(--ozer-border-on-light)] bg-[var(--ozer-sage-100)] px-2.5 py-2">
          <RefreshCw className="h-3.5 w-3.5 text-[var(--ozer-plum-900)]" />
          <p className="mt-1 text-[10px] font-medium text-[var(--ozer-plum-900)]">Synced with project</p>
        </div>
      </div>
    </div>
  );
}

function InvoicingCover({ compact }: { compact: boolean }) {
  return (
    <div className="flex h-full flex-col rounded-[1.25rem] bg-[var(--ozer-sage-100)] p-4 text-[var(--ozer-text-on-light)]">
      <div className="flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-[var(--ozer-plum-900)]" />
        <p className={cn('font-semibold', compact ? 'text-xs' : 'text-sm')}>From project</p>
      </div>
      <div className="mt-3 rounded-xl bg-[var(--ozer-white)] p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-[var(--ozer-text-on-light-muted)]">Invoice · Acme rebrand</p>
            <p className={cn('font-bold', compact ? 'text-lg' : 'text-xl')}>£2,400</p>
          </div>
          <FileText className="h-8 w-8 text-[var(--ozer-accent)]/40" />
        </div>
        <p className="mt-2 text-[10px] text-[var(--ozer-text-on-light-muted)]">Client details pre-filled from project</p>
      </div>
    </div>
  );
}

function SecondBrainCover({ compact }: { compact: boolean }) {
  return (
    <div className="flex h-full flex-col rounded-[1.25rem] border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-plum-950)] p-4">
      <div className="flex items-center gap-2">
        <Brain className="h-4 w-4 text-[var(--ozer-coral-400)]" />
        <p className={cn('font-semibold text-[var(--ozer-text-on-dark)]', compact ? 'text-xs' : 'text-sm')}>
          Ask your second brain
        </p>
      </div>
      <div className="mt-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 py-2">
        <div className="flex items-center gap-2 text-[var(--ozer-text-on-dark-muted)]">
          <Search className="h-3 w-3 shrink-0" />
          <p className="truncate text-[11px]">What did we agree with Acme on launch?</p>
        </div>
      </div>
      <div className="mt-2 flex-1 rounded-xl border border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-plum-800)] p-3">
        <p className={cn('leading-relaxed text-[var(--ozer-text-on-dark)]/90', compact ? 'text-[10px]' : 'text-[11px]')}>
          Launch is <span className="font-semibold text-[var(--workspace-shell-text)]">14 March</span> — from kickoff
          transcript and follow-up email.
        </p>
      </div>
    </div>
  );
}

function MessagingCover({ compact }: { compact: boolean }) {
  return (
    <div className="flex h-full flex-col rounded-[1.25rem] border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-plum-950)] p-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-[var(--ozer-coral-400)]" />
        <p className={cn('font-semibold text-[var(--ozer-text-on-dark)]', compact ? 'text-xs' : 'text-sm')}>
          Acme rebrand project
        </p>
      </div>
      <div className="mt-3 space-y-2">
        <div className="ml-6 rounded-xl rounded-tr-sm bg-[var(--ozer-accent-subtle)] px-3 py-2">
          <p className="text-[10px] text-[var(--ozer-text-on-dark)]/90">Portal looks great — approve v3?</p>
        </div>
        <div className="mr-6 rounded-xl rounded-tl-sm bg-[var(--ozer-plum-800)] px-3 py-2">
          <p className="text-[10px] text-[var(--workspace-shell-text)]/80">Approved. Please send the invoice.</p>
        </div>
      </div>
      <p className="mt-auto text-[9px] text-[var(--ozer-text-on-dark-muted)]">Thread saved to project record</p>
    </div>
  );
}

function NotesCover({ compact }: { compact: boolean }) {
  return (
    <div className="flex h-full flex-col rounded-[1.25rem] bg-[var(--ozer-coral-50)] p-4 text-[var(--ozer-text-on-light)]">
      <div className="flex items-center gap-2">
        <StickyNote className="h-4 w-4 text-[var(--ozer-plum-900)]" />
        <p className={cn('font-semibold', compact ? 'text-xs' : 'text-sm')}>Project notes</p>
      </div>
      <div className="mt-3 flex-1 rounded-xl bg-[var(--ozer-white)] p-3">
        <p className="text-[10px] font-semibold text-[var(--ozer-text-on-light-muted)]">Acme kickoff</p>
        <ul className={cn('mt-2 space-y-1 text-[var(--ozer-text-on-light)]', compact ? 'text-[10px]' : 'text-xs')}>
          <li>• Launch date: 14 March</li>
          <li>• Portal mockups in phase two</li>
          <li>• Weekly check-in Thursdays</li>
        </ul>
      </div>
    </div>
  );
}

function PipelineCover({ compact }: { compact: boolean }) {
  return (
    <div className="flex h-full flex-col rounded-[1.25rem] bg-[var(--ozer-sky-100)] p-4 text-[var(--ozer-text-on-light)]">
      <div className="flex items-center gap-2">
        <Kanban className="h-4 w-4 text-[var(--ozer-slate-blue)]" />
        <p className={cn('font-semibold', compact ? 'text-xs' : 'text-sm')}>Pipeline</p>
      </div>
      <div className="mt-3 grid flex-1 grid-cols-3 gap-2">
        {[
          { label: 'Lead', count: 4 },
          { label: 'Proposal', count: 2 },
          { label: 'Won', count: 1 },
        ].map((col) => (
          <div key={col.label} className="rounded-xl bg-[var(--ozer-white)] p-2">
            <p className="text-[10px] font-semibold text-[var(--ozer-text-on-light-muted)]">{col.label}</p>
            <p className={cn('font-bold', compact ? 'text-lg' : 'text-xl')}>{col.count}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectManagementCover({ compact }: { compact: boolean }) {
  return (
    <div className="flex h-full flex-col rounded-[1.25rem] border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-plum-950)] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-[var(--ozer-lime-400)]" />
          <p className={cn('font-semibold text-[var(--workspace-shell-text)]', compact ? 'text-xs' : 'text-sm')}>
            Active projects
          </p>
        </div>
        <span className="text-[9px] text-[var(--workspace-shell-text-muted)]">Timeline</span>
      </div>
      <div className="mt-3 space-y-2">
        {[
          { name: 'Acme rebrand', phase: 'Design', pct: 65, color: 'var(--ozer-info)' },
          { name: 'North Lane site', phase: 'Build', pct: 40, color: 'var(--ozer-accent)' },
        ].map((row) => (
          <div key={row.name} className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className={cn('truncate font-medium text-[var(--workspace-shell-text)]/90', compact ? 'text-[10px]' : 'text-xs')}>
                {row.name}
              </p>
              <span className="text-[9px] text-[var(--workspace-shell-text-muted)]">{row.phase}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--workspace-shell-sidebar-accent)]">
              <div
                className="h-full rounded-full"
                style={{ width: `${row.pct}%`, backgroundColor: row.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TasksCover({ compact }: { compact: boolean }) {
  return (
    <div className="flex h-full flex-col rounded-[1.25rem] border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-plum-950)] p-4">
      <div className="flex items-center gap-2">
        <CheckSquare className="h-4 w-4 text-[var(--ozer-lime-400)]" />
        <p className={cn('font-semibold text-[var(--workspace-shell-text)]', compact ? 'text-xs' : 'text-sm')}>
          All tasks
        </p>
      </div>
      <div className="mt-3 space-y-1.5">
        {[
          { title: 'Send proposal revision', client: 'Acme', urgent: true },
          { title: 'Review portal mockups', client: 'North Lane', urgent: false },
          { title: 'School run prep', client: 'Personal', urgent: false },
        ].map((row) => (
          <div
            key={row.title}
            className="flex items-center gap-2 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-2 py-1.5"
          >
            <span className="h-3.5 w-3.5 shrink-0 rounded border border-[color:var(--workspace-shell-border)]" />
            <div className="min-w-0 flex-1">
              <p className={cn('truncate text-[var(--workspace-shell-text)]/85', compact ? 'text-[10px]' : 'text-[11px]')}>
                {row.title}
              </p>
              <p className="text-[9px] text-[var(--workspace-shell-text-muted)]">{row.client}</p>
            </div>
            {row.urgent ? (
              <span className="text-[9px] text-[var(--ozer-accent)]">Urgent</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function ContractsCover({ compact }: { compact: boolean }) {
  return (
    <div className="flex h-full flex-col rounded-[1.25rem] bg-[var(--ozer-sage-100)] p-4 text-[var(--ozer-text-on-light)]">
      <div className="flex items-center gap-2">
        <FileSignature className="h-4 w-4 text-[var(--ozer-plum-900)]" />
        <p className={cn('font-semibold', compact ? 'text-xs' : 'text-sm')}>Contracts</p>
      </div>
      <div className="mt-3 space-y-2">
        {[
          { title: 'Acme SOW — Phase 1', status: 'Signed', tone: 'text-[var(--ozer-plum-900)] bg-[var(--ozer-sage-300)]' },
          { title: 'North Lane retainer', status: 'Sent', tone: 'text-[var(--ozer-plum-900)] bg-[var(--ozer-coral-100)]' },
        ].map((row) => (
          <div
            key={row.title}
            className="flex items-center justify-between rounded-xl bg-[var(--ozer-white)] px-3 py-2"
          >
            <p className={cn('truncate font-medium', compact ? 'text-[10px]' : 'text-xs')}>
              {row.title}
            </p>
            <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-medium', row.tone)}>
              {row.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SopsCover({ compact }: { compact: boolean }) {
  return (
    <div className="flex h-full flex-col rounded-[1.25rem] border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-plum-950)] p-4">
      <div className="flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-[var(--ozer-coral-400)]" />
        <p className={cn('font-semibold text-[var(--workspace-shell-text)]', compact ? 'text-xs' : 'text-sm')}>
          Monthly close
        </p>
      </div>
      <div className="mt-3 space-y-1.5">
        {[
          { step: 'Reconcile bank feed', done: true },
          { step: 'Chase outstanding invoices', done: true },
          { step: 'File contractor expenses', done: false },
        ].map((row) => (
          <div key={row.step} className="flex items-center gap-2 rounded-lg bg-[var(--workspace-shell-sidebar-accent)] px-2 py-1.5">
            {row.done ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[var(--ozer-lime-400)]" />
            ) : (
              <span className="h-3.5 w-3.5 shrink-0 rounded border border-[color:var(--workspace-shell-border)]" />
            )}
            <p className={cn('text-[var(--workspace-shell-text)]/85', compact ? 'text-[10px]' : 'text-[11px]')}>{row.step}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[9px] text-[var(--workspace-shell-text-muted)]">2 of 3 complete</p>
    </div>
  );
}

function FinancesCover({ compact }: { compact: boolean }) {
  return (
    <div className="flex h-full flex-col rounded-[1.25rem] border border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-plum-950)] p-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-[var(--ozer-lime-400)]" />
        <p className={cn('font-semibold text-[var(--ozer-text-on-dark)]', compact ? 'text-xs' : 'text-sm')}>
          Revenue overview
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-plum-800)] p-2.5">
          <p className="text-[9px] text-[var(--ozer-text-on-dark-muted)]">This month</p>
          <p className={cn('font-bold text-[var(--ozer-text-on-dark)]', compact ? 'text-lg' : 'text-xl')}>£8.2k</p>
        </div>
        <div className="rounded-xl border border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-plum-800)] p-2.5">
          <p className="text-[9px] text-[var(--ozer-text-on-dark-muted)]">Outstanding</p>
          <p className={cn('font-bold text-[var(--ozer-coral-400)]', compact ? 'text-lg' : 'text-xl')}>£1.4k</p>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[9px] text-[var(--ozer-text-on-dark-muted)]">
        <RefreshCw className="h-3 w-3" />
        FreeAgent synced
      </div>
    </div>
  );
}

export function DashboardImageCover({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-plum-950)]',
        className,
      )}
    >
      <Image
        src="/images/dashboard.webp"
        alt="Ozer dashboard"
        fill
        className="object-cover object-top"
        sizes="(max-width: 768px) 100vw, 640px"
      />
    </div>
  );
}
