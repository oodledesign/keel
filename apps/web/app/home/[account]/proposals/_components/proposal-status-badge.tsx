'use client';

const STATUS_STYLES: Record<string, string> = {
  draft:
    'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]',
  sent: 'border-[#39AEB3]/30 bg-[#39AEB3]/12 text-[#B8D3D7]',
  read: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  approved:
    'border-[var(--ozer-accent)]/30 bg-[var(--ozer-accent)]/12 text-[#97D9AA]',
  declined: 'border-[#E85D75]/30 bg-[#E85D75]/12 text-[#F6A7B5]',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  read: 'Read',
  approved: 'Approved',
  declined: 'Declined',
};

export function ProposalStatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase();
  const label = (STATUS_LABELS[key] ?? status).toUpperCase();
  const classes = STATUS_STYLES[key] ?? STATUS_STYLES.draft;

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] ${classes}`}
    >
      {label}
    </span>
  );
}
