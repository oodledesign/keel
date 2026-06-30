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
        'relative overflow-hidden rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-plum-950)] shadow-[0_24px_80px_rgba(0,0,0,0.35)]',
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
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--ozer-plum-950)] to-transparent" />
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
    <div className="flex h-full flex-col rounded-[1.25rem] bg-[linear-gradient(145deg,#fef3c7,#fde68a)] p-4 text-[var(--ozer-text-on-light)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-amber-700" />
          <p className={cn('font-semibold', compact ? 'text-xs' : 'text-sm')}>
            Today&apos;s plan
          </p>
        </div>
        <Sun className="h-4 w-4 text-amber-600" />
      </div>
      <div className="mt-3 space-y-2">
        {[
          { time: '09:00', task: 'Deep work — Acme proposal', done: true },
          { time: '11:30', task: 'Client call prep', done: false },
          { time: '14:00', task: 'Review portal feedback', done: false },
        ].map((row) => (
          <div
            key={row.task}
            className="flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2"
          >
            {row.done ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-teal-600" />
            ) : (
              <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-amber-400" />
            )}
            <div className="min-w-0">
              <p className="font-mono text-[10px] text-amber-800/70">{row.time}</p>
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
    <div className="flex h-full flex-col rounded-[1.25rem] border border-[color:var(--workspace-shell-border)] bg-[linear-gradient(160deg,#1a1630,#2d1f4e)] p-4">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-violet-300" />
        <p className={cn('font-semibold text-violet-50', compact ? 'text-xs' : 'text-sm')}>
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
            <p className="text-[10px] font-semibold text-teal-200/90">{row.client}</p>
            <p className={cn('text-violet-50/90', compact ? 'text-[11px]' : 'text-xs')}>
              {row.subject}
            </p>
            <span className="mt-1 inline-block rounded-md border border-teal-400/20 bg-teal-500/10 px-1.5 py-0.5 text-[9px] text-teal-200">
              {row.tag}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-auto flex items-center gap-1.5 pt-2 text-[9px] text-violet-200/60">
        <Sparkles className="h-3 w-3" />
        AI draft with project context
      </div>
    </div>
  );
}

function DesktopAssistantCover({ compact }: { compact: boolean }) {
  return (
    <div className="flex h-full flex-col rounded-[1.25rem] border border-[color:var(--workspace-shell-border)] bg-[linear-gradient(160deg,#1a1630,#2d1f4e)] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/20">
            <Mic className="h-3.5 w-3.5 text-violet-300" />
          </span>
          <div>
            <p className={cn('font-semibold text-violet-50', compact ? 'text-xs' : 'text-sm')}>
              Client kickoff
            </p>
            <p className="text-[10px] text-violet-200/60">Ozer Assistant · macOS</p>
          </div>
        </div>
        <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[9px] font-medium text-rose-200">
          Recording
        </span>
      </div>
      <div className="mt-3 grid flex-1 gap-2 md:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-violet-300/70">
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
              <p className="text-[9px] font-semibold text-violet-300/80">{line.speaker}</p>
              <p className="truncate text-[10px] text-violet-50/85">{line.text}</p>
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-teal-300/70">
            Tasks
          </p>
          {[
            'Send proposal by Friday',
            'Add portal mockups to scope',
            'Schedule follow-up call',
          ].map((task) => (
            <div
              key={task}
              className="flex items-start gap-1.5 rounded-lg border border-teal-400/15 bg-teal-500/10 px-2 py-1.5"
            >
              <CheckSquare className="mt-0.5 h-3 w-3 shrink-0 text-teal-300" />
              <p className="text-[10px] leading-snug text-teal-50/90">{task}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DictationCover({ compact }: { compact: boolean }) {
  return (
    <div className="flex h-full flex-col rounded-[1.25rem] border border-[color:var(--workspace-shell-border)] bg-[linear-gradient(155deg,#0c1929,#122a45)] p-4">
      <div className="flex items-center gap-2">
        <Keyboard className="h-4 w-4 text-sky-300" />
        <p className={cn('font-semibold text-sky-50', compact ? 'text-xs' : 'text-sm')}>
          Dictation
        </p>
        <span className="ml-auto rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--workspace-shell-text)]/60">
          fn
        </span>
      </div>
      <div className="mt-3 flex-1 rounded-xl border border-sky-400/15 bg-sky-500/[0.08] p-3">
        <p className="text-[10px] text-sky-200/60">Speaking into any app…</p>
        <p className={cn('mt-2 leading-relaxed text-sky-50/95', compact ? 'text-[11px]' : 'text-xs')}>
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
    <div className="flex h-full flex-col rounded-[1.25rem] bg-[linear-gradient(145deg,#ede9fe,#ddd6fe)] p-4 text-[var(--ozer-text-on-light)]">
      <div className="flex items-center gap-2">
        <LayoutDashboard className="h-4 w-4 text-violet-700" />
        <p className={cn('font-semibold', compact ? 'text-xs' : 'text-sm')}>
          Acme client portal
        </p>
      </div>
      <div className="mt-3 grid flex-1 grid-cols-2 gap-2">
        {['Brand guidelines.pdf', 'Homepage v3', 'Invoice #1042'].map((item) => (
          <div
            key={item}
            className="rounded-xl border border-violet-300/30 bg-white/70 px-2.5 py-2"
          >
            <p className={cn('font-medium', compact ? 'text-[10px]' : 'text-xs')}>{item}</p>
            <p className="mt-1 text-[9px] text-violet-700/70">Ready for review</p>
          </div>
        ))}
        <div className="rounded-xl border border-teal-300/40 bg-teal-50 px-2.5 py-2">
          <RefreshCw className="h-3.5 w-3.5 text-teal-700" />
          <p className="mt-1 text-[10px] font-medium text-teal-900">Synced with project</p>
        </div>
      </div>
    </div>
  );
}

function InvoicingCover({ compact }: { compact: boolean }) {
  return (
    <div className="flex h-full flex-col rounded-[1.25rem] bg-[linear-gradient(145deg,#ccfbf1,#99f6e4)] p-4 text-[var(--ozer-text-on-light)]">
      <div className="flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-teal-700" />
        <p className={cn('font-semibold', compact ? 'text-xs' : 'text-sm')}>From project</p>
      </div>
      <div className="mt-3 rounded-xl bg-white/80 p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-[var(--ozer-text-on-light-muted)]">Invoice · Acme rebrand</p>
            <p className={cn('font-bold', compact ? 'text-lg' : 'text-xl')}>£2,400</p>
          </div>
          <FileText className="h-8 w-8 text-teal-600/40" />
        </div>
        <p className="mt-2 text-[10px] text-slate-600">Client details pre-filled from project</p>
      </div>
    </div>
  );
}

function SecondBrainCover({ compact }: { compact: boolean }) {
  return (
    <div className="flex h-full flex-col rounded-[1.25rem] border border-[color:var(--workspace-shell-border)] bg-[linear-gradient(155deg,#0f172a,#1e1b4b)] p-4">
      <div className="flex items-center gap-2">
        <Brain className="h-4 w-4 text-violet-300" />
        <p className={cn('font-semibold text-violet-100', compact ? 'text-xs' : 'text-sm')}>
          Ask your second brain
        </p>
      </div>
      <div className="mt-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 py-2">
        <div className="flex items-center gap-2 text-violet-200/70">
          <Search className="h-3 w-3 shrink-0" />
          <p className="truncate text-[11px]">What did we agree with Acme on launch?</p>
        </div>
      </div>
      <div className="mt-2 flex-1 rounded-xl border border-violet-400/15 bg-violet-500/[0.07] p-3">
        <p className={cn('leading-relaxed text-violet-50/90', compact ? 'text-[10px]' : 'text-[11px]')}>
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
        <MessageSquare className="h-4 w-4 text-violet-300" />
        <p className={cn('font-semibold text-violet-50', compact ? 'text-xs' : 'text-sm')}>
          Acme rebrand project
        </p>
      </div>
      <div className="mt-3 space-y-2">
        <div className="ml-6 rounded-xl rounded-tr-sm bg-violet-500/20 px-3 py-2">
          <p className="text-[10px] text-violet-100/90">Portal looks great — approve v3?</p>
        </div>
        <div className="mr-6 rounded-xl rounded-tl-sm bg-white/8 px-3 py-2">
          <p className="text-[10px] text-[var(--workspace-shell-text)]/80">Approved. Please send the invoice.</p>
        </div>
      </div>
      <p className="mt-auto text-[9px] text-violet-200/50">Thread saved to project record</p>
    </div>
  );
}

function NotesCover({ compact }: { compact: boolean }) {
  return (
    <div className="flex h-full flex-col rounded-[1.25rem] bg-[linear-gradient(145deg,#fff7ed,#ffedd5)] p-4 text-[var(--ozer-text-on-light)]">
      <div className="flex items-center gap-2">
        <StickyNote className="h-4 w-4 text-amber-700" />
        <p className={cn('font-semibold', compact ? 'text-xs' : 'text-sm')}>Project notes</p>
      </div>
      <div className="mt-3 flex-1 rounded-xl bg-white/80 p-3">
        <p className="text-[10px] font-semibold text-amber-800/80">Acme kickoff</p>
        <ul className={cn('mt-2 space-y-1 text-amber-950/80', compact ? 'text-[10px]' : 'text-xs')}>
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
    <div className="flex h-full flex-col rounded-[1.25rem] bg-[linear-gradient(145deg,#ede9fe,#ddd6fe)] p-4 text-[var(--ozer-text-on-light)]">
      <div className="flex items-center gap-2">
        <Kanban className="h-4 w-4 text-violet-700" />
        <p className={cn('font-semibold', compact ? 'text-xs' : 'text-sm')}>Pipeline</p>
      </div>
      <div className="mt-3 grid flex-1 grid-cols-3 gap-2">
        {[
          { label: 'Lead', count: 4 },
          { label: 'Proposal', count: 2 },
          { label: 'Won', count: 1 },
        ].map((col) => (
          <div key={col.label} className="rounded-xl bg-white/70 p-2">
            <p className="text-[10px] font-semibold text-slate-600">{col.label}</p>
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
          <FolderKanban className="h-4 w-4 text-teal-300" />
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
        <CheckSquare className="h-4 w-4 text-teal-300" />
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
              <span className="text-[9px] text-rose-300">Urgent</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function ContractsCover({ compact }: { compact: boolean }) {
  return (
    <div className="flex h-full flex-col rounded-[1.25rem] bg-[linear-gradient(145deg,#ecfdf5,#d1fae5)] p-4 text-[var(--ozer-text-on-light)]">
      <div className="flex items-center gap-2">
        <FileSignature className="h-4 w-4 text-emerald-700" />
        <p className={cn('font-semibold', compact ? 'text-xs' : 'text-sm')}>Contracts</p>
      </div>
      <div className="mt-3 space-y-2">
        {[
          { title: 'Acme SOW — Phase 1', status: 'Signed', tone: 'text-emerald-700 bg-emerald-100' },
          { title: 'North Lane retainer', status: 'Sent', tone: 'text-amber-700 bg-amber-100' },
        ].map((row) => (
          <div
            key={row.title}
            className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-2"
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
        <ListChecks className="h-4 w-4 text-violet-300" />
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
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-teal-400" />
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
    <div className="flex h-full flex-col rounded-[1.25rem] border border-emerald-400/20 bg-[linear-gradient(155deg,#052e2b,#0a3d38)] p-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-emerald-300" />
        <p className={cn('font-semibold text-emerald-50', compact ? 'text-xs' : 'text-sm')}>
          Revenue overview
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-emerald-400/15 bg-emerald-500/10 p-2.5">
          <p className="text-[9px] text-emerald-200/70">This month</p>
          <p className={cn('font-bold text-emerald-50', compact ? 'text-lg' : 'text-xl')}>£8.2k</p>
        </div>
        <div className="rounded-xl border border-amber-400/15 bg-amber-500/10 p-2.5">
          <p className="text-[9px] text-amber-200/70">Outstanding</p>
          <p className={cn('font-bold text-amber-50', compact ? 'text-lg' : 'text-xl')}>£1.4k</p>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[9px] text-emerald-200/60">
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
