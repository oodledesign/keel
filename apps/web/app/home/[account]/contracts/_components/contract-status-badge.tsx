'use client';

const STATUS_STYLES: Record<string, string> = {
  draft: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',
  ready_to_sign: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  sent: 'border-[#39AEB3]/30 bg-[#39AEB3]/12 text-[#B8D3D7]',
  signed: 'border-[var(--keel-teal)]/30 bg-[var(--keel-teal)]/12 text-[#97D9AA]',
  cancelled: 'border-zinc-600/30 bg-zinc-700/20 text-zinc-400',
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
