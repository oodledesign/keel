'use client';

const STATUS_STYLES: Record<string, string> = {
  draft:
    'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]',
  ready_to_sign: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  sent: 'border-[#39AEB3]/30 bg-[#39AEB3]/12 text-[#B8D3D7]',
  signed:
    'border-[var(--ozer-accent)]/30 bg-[var(--ozer-accent)]/12 text-[#97D9AA]',
  cancelled:
    'border-[color:var(--workspace-shell-border)]/30 bg-[var(--workspace-shell-panel-hover)]/20 text-[var(--workspace-shell-text-muted)]',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  ready_to_sign: 'Ready to sign',
  sent: 'Sent',
  signed: 'Signed',
  cancelled: 'Cancelled',
};

export function ContractStatusBadge({
  status,
}: {
  status: string;
  authorSignedAt?: string | null;
  recipientSignedAt?: string | null;
}) {
  const label = (STATUS_LABELS[status] ?? status).toUpperCase();
  const classes = STATUS_STYLES[status] ?? STATUS_STYLES.draft;

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] ${classes}`}
    >
      {label}
    </span>
  );
}
