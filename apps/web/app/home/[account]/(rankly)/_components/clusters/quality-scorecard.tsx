'use client';

type QualityGate = {
  gate: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string | null;
};

const STATUS_COLOURS = {
  pass: 'text-[var(--ozer-accent)]',
  warn: 'text-[#F0C14B]',
  fail: 'text-[var(--ozer-accent-pressed,#C2452A)]',
} as const;

const STATUS_ICONS = {
  pass: '✓',
  warn: '!',
  fail: '✕',
} as const;

function formatGate(gate: string) {
  return gate.replace(/_/g, ' ');
}

export function QualityScorecard({ gates }: { gates: QualityGate[] }) {
  if (gates.length === 0) return null;

  const allPass = gates.every((gate) => gate.status === 'pass');

  if (allPass) {
    return (
      <div className="rounded-lg border border-[var(--ozer-accent)]/30 bg-[var(--ozer-accent-subtle)] px-4 py-3 text-sm text-[var(--workspace-shell-text)]">
        All quality gates passed — cannibalisation, orphan, coverage, anchor
        diversity
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[color:var(--workspace-shell-border)]">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-xs tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
          <tr>
            <th className="px-4 py-3">Gate</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Detail</th>
          </tr>
        </thead>
        <tbody>
          {gates.map((gate) => (
            <tr
              key={gate.gate}
              className="border-b border-[color:var(--workspace-shell-border)] last:border-0"
            >
              <td className="px-4 py-3 capitalize">{formatGate(gate.gate)}</td>
              <td
                className={`px-4 py-3 font-medium ${STATUS_COLOURS[gate.status]}`}
              >
                {STATUS_ICONS[gate.status]} {gate.status}
              </td>
              <td className="px-4 py-3 text-[var(--workspace-shell-text-muted)]">
                {gate.detail ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
