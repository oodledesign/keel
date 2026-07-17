'use client';

type QualityGate = {
  gate: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string | null;
};

const STATUS_COLOURS = {
  pass: 'text-emerald-400',
  warn: 'text-amber-400',
  fail: 'text-red-400',
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
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
        All quality gates passed — cannibalisation, orphan, coverage, anchor
        diversity
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[color:var(--workspace-shell-border)]">
      <table className="w-full text-left text-sm">
        <thead className="text-muted-foreground border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-xs tracking-wide uppercase">
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
              <td className="text-muted-foreground px-4 py-3">
                {gate.detail ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
