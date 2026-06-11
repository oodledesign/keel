export type FinanceAmountRow = {
  amount_pence: number;
  is_transfer?: boolean | null;
};

export function isFinanceTransfer(tx: FinanceAmountRow): boolean {
  return Boolean(tx.is_transfer);
}

export function accumulateFinanceTotals(transactions: FinanceAmountRow[]) {
  let incomePence = 0;
  let expensePence = 0;
  let transferPence = 0;

  for (const tx of transactions) {
    const pence = tx.amount_pence ?? 0;

    if (isFinanceTransfer(tx)) {
      transferPence += Math.abs(pence);
      continue;
    }

    if (pence >= 0) {
      incomePence += pence;
    } else {
      expensePence += Math.abs(pence);
    }
  }

  return {
    incomePence,
    expensePence,
    netPence: incomePence - expensePence,
    transferPence,
  };
}
