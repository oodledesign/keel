export type RecorderTodayFinanceMonth = {
  month: string;
  month_key: string;
  /** Major currency units — same as the business dashboard chart. */
  income: number;
  /** Major currency units — dashboard `expenses`. */
  outgoings: number;
  net: number;
  is_current: boolean;
};

export type RecorderTodayFinance = {
  account_id: string;
  workspace_slug: string;
  workspace_name: string;
  currency: string;
  path: string;
  income_pence: number;
  outgoings_pence: number;
  net_pence: number;
  months: RecorderTodayFinanceMonth[];
};

export type FinanceWorkspaceCandidate = {
  id: string;
  name: string | null;
  slug: string | null;
};

export type DashboardTrendPoint = {
  month: string;
  monthKey?: string;
  income: number;
  expenses: number;
  net: number;
  isCurrent: boolean;
};

export function mapDashboardTrendToRecorderMonths(
  trend: DashboardTrendPoint[],
): RecorderTodayFinanceMonth[] {
  return trend.map((point) => ({
    month: point.month,
    month_key: point.monthKey ?? point.month,
    income: point.income,
    outgoings: point.expenses,
    net: point.net,
    is_current: point.isCurrent,
  }));
}

export function pickFinanceWorkspace(
  candidates: FinanceWorkspaceCandidate[],
  withDataIds: Set<string>,
  preferredAccountId?: string | null,
): FinanceWorkspaceCandidate | null {
  const withData = candidates.filter((workspace) =>
    withDataIds.has(workspace.id),
  );
  if (withData.length === 0) {
    return null;
  }

  if (preferredAccountId) {
    const preferred = withData.find(
      (workspace) => workspace.id === preferredAccountId,
    );
    if (preferred) {
      return preferred;
    }
  }

  return withData[0] ?? null;
}
