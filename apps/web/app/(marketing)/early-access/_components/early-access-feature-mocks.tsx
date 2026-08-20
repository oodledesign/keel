import { cn } from '@kit/ui/utils';

import {
  EARLY_ACCESS_ACCENT_CLASS,
  EARLY_ACCESS_ACCENT_SOFT_CLASS,
  EARLY_ACCESS_ACCENT_TEXT_CLASS,
  type EarlyAccessAccent,
} from '~/lib/marketing/early-access-content';

function MockShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'w-full rounded-[1.25rem] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function KanbanMock() {
  const columns = [
    { label: 'Enquiry', items: ['Logo refresh', 'Landing page'] },
    { label: 'In progress', items: ['Brand guide'] },
    { label: 'Invoiced', items: ['Website build'] },
  ];

  return (
    <MockShell>
      <div className="grid grid-cols-3 gap-2.5">
        {columns.map((col) => (
          <div key={col.label}>
            <p className="mb-2 text-[10px] font-medium tracking-[0.04em] text-[var(--workspace-shell-text-muted)] uppercase">
              {col.label}
            </p>
            {col.items.map((item) => (
              <div
                key={item}
                className="mb-2 rounded-[0.625rem] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] px-2.5 py-2.5 text-xs text-[var(--workspace-shell-text-muted)]"
              >
                {item}
              </div>
            ))}
          </div>
        ))}
      </div>
    </MockShell>
  );
}

export function InvoiceMock() {
  const rows = [
    { name: 'Website redesign', amount: '£1,200', status: 'Paid' as const },
    { name: 'Brand assets', amount: '£450', status: 'Sent' as const },
    { name: 'Monthly retainer', amount: '£300', status: 'Due' as const },
  ];

  const statusClass = {
    Paid: 'bg-[var(--ozer-sage-100)] text-[var(--ozer-plum-700)]',
    Sent: 'bg-[var(--ozer-sky-100)] text-[var(--ozer-cool-blue)]',
    Due: 'bg-[var(--ozer-coral-50)] text-[var(--ozer-coral-600)]',
  };

  return (
    <MockShell className="flex flex-col gap-2">
      {rows.map((row) => (
        <div
          key={row.name}
          className="flex items-center gap-2.5 border-b border-[color:var(--workspace-shell-border)] py-2 text-sm last:border-b-0"
        >
          <span className="flex-1 text-[var(--workspace-shell-text)]">
            {row.name}
          </span>
          <span className="font-mono text-xs text-[var(--workspace-shell-text-muted)]">
            {row.amount}
          </span>
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-[0.03em] uppercase',
              statusClass[row.status],
            )}
          >
            {row.status}
          </span>
        </div>
      ))}
      <div className="flex justify-between pt-1 text-sm font-bold text-[var(--workspace-shell-text)]">
        <span>Outstanding</span>
        <span>£750</span>
      </div>
    </MockShell>
  );
}

export function PortalMock() {
  const files = [
    'Homepage_v3.fig',
    'Brand_guidelines.pdf',
    'Meeting_notes_Aug.md',
  ];

  return (
    <MockShell className="flex flex-col gap-2.5">
      {files.map((file) => (
        <div key={file} className="flex items-center gap-2.5 text-sm">
          <span
            className="size-2 shrink-0 rounded-[3px] bg-[var(--ozer-sage-500)]"
            aria-hidden
          />
          <span className="flex-1 text-[var(--workspace-shell-text)]">
            {file}
          </span>
          <span className="text-xs text-[var(--workspace-shell-text-muted)]">
            Shared
          </span>
        </div>
      ))}
    </MockShell>
  );
}

export function NotesMock() {
  return (
    <MockShell>
      <p className="mb-3 text-sm font-bold text-[var(--workspace-shell-text)]">
        Call with Aimee — 14 Aug
      </p>
      <div className="mb-2 h-2 w-[82%] rounded bg-[color:var(--workspace-shell-border)]" />
      <div className="mb-3 h-2 w-[58%] rounded bg-[color:var(--workspace-shell-border)]" />
      <div className="flex gap-2">
        <span className="rounded-full bg-[var(--ozer-lime-100)] px-2.5 py-1 text-[11px] font-bold text-[var(--ozer-plum-700)]">
          next-step
        </span>
        <span className="rounded-full bg-[var(--ozer-lime-100)] px-2.5 py-1 text-[11px] font-bold text-[var(--ozer-plum-700)]">
          pricing
        </span>
      </div>
    </MockShell>
  );
}

export function EmailMock() {
  return (
    <MockShell className="relative flex flex-col gap-2.5">
      <div className="h-3.5 rounded-md border border-dashed border-[color:var(--workspace-shell-border)]" />
      <div className="h-3.5 w-3/5 rounded-md border border-dashed border-[color:var(--workspace-shell-border)]" />
      <div className="h-3.5 rounded-md border border-dashed border-[color:var(--workspace-shell-border)]" />
      <span className="mt-1.5 self-start rounded-full bg-[var(--ozer-plum-alpha-08)] px-3 py-1 text-[11px] font-bold text-[var(--ozer-plum-600)]">
        Coming soon
      </span>
    </MockShell>
  );
}

export function PlannerMock({ accent }: { accent: EarlyAccessAccent }) {
  const slots = [
    { time: '9:00', label: 'Client call — Aimee', active: true },
    { time: '11:00', label: 'Deep work — website build' },
    { time: '14:00', label: 'Task: send invoice' },
    { time: '16:00', label: 'Follow-up emails' },
  ];

  return (
    <MockShell className="flex flex-col gap-2.5">
      {slots.map((slot) => (
        <div key={slot.time} className="flex items-center gap-2.5 text-xs">
          <span className="w-9 shrink-0 font-mono text-[var(--workspace-shell-text-muted)]">
            {slot.time}
          </span>
          <span
            className={cn(
              'h-5 w-0.5 shrink-0 rounded-sm',
              slot.active
                ? EARLY_ACCESS_ACCENT_CLASS[accent]
                : 'bg-[color:var(--workspace-shell-border)]',
            )}
          />
          <span
            className={cn(
              slot.active
                ? 'font-bold text-[var(--workspace-shell-text)]'
                : 'text-[var(--workspace-shell-text-muted)]',
            )}
          >
            {slot.label}
          </span>
        </div>
      ))}
      <span className="mt-1 self-start rounded-full bg-[var(--ozer-plum-alpha-08)] px-3 py-1 text-[11px] font-bold text-[var(--ozer-plum-600)]">
        Coming soon
      </span>
    </MockShell>
  );
}

export function RequestsMock({ accent }: { accent: EarlyAccessAccent }) {
  const services = [
    { name: 'Landing page copy edit', cost: '2' },
    { name: 'New page build', cost: '6' },
    { name: 'Social media graphic', cost: '1' },
  ];

  return (
    <MockShell className="flex flex-col gap-2">
      {services.map((service) => (
        <div
          key={service.name}
          className="flex items-center justify-between gap-3 border-b border-[color:var(--workspace-shell-border)] py-2 text-sm last:border-b-0"
        >
          <span className="text-[var(--workspace-shell-text)]">
            {service.name}
          </span>
          <span
            className={cn(
              'shrink-0 rounded-full px-2.5 py-0.5 font-mono text-[11px]',
              EARLY_ACCESS_ACCENT_SOFT_CLASS[accent],
            )}
          >
            {service.cost} credits
          </span>
        </div>
      ))}
      <div className="flex justify-between pt-1 text-sm font-bold text-[var(--workspace-shell-text)]">
        <span>Credits remaining</span>
        <span className={EARLY_ACCESS_ACCENT_TEXT_CLASS[accent]}>14</span>
      </div>
    </MockShell>
  );
}

export function EarlyAccessFeatureMock({
  type,
  accent,
}: {
  type:
    | 'kanban'
    | 'invoice'
    | 'portal'
    | 'notes'
    | 'email'
    | 'requests'
    | 'planner';
  accent: EarlyAccessAccent;
}) {
  switch (type) {
    case 'kanban':
      return <KanbanMock />;
    case 'invoice':
      return <InvoiceMock />;
    case 'portal':
      return <PortalMock />;
    case 'notes':
      return <NotesMock />;
    case 'email':
      return <EmailMock />;
    case 'requests':
      return <RequestsMock accent={accent} />;
    case 'planner':
      return <PlannerMock accent={accent} />;
    default:
      return null;
  }
}
