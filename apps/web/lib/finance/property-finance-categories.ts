export const PROPERTY_FINANCE_DEFAULT_CATEGORIES = [
  { name: 'Rent', kind: 'income' as const },
  { name: 'Capital/Purchase', kind: 'expense' as const },
  { name: 'Agents Fees', kind: 'expense' as const },
  { name: 'Repairs/Maintenance', kind: 'expense' as const },
  { name: 'Mortgage Interest', kind: 'expense' as const },
  { name: 'Other payments', kind: 'expense' as const },
];

type FinanceCategoryRow = {
  id: string;
  name: string;
  kind: string;
};

export function suggestPropertyImportCategoryId(
  categories: FinanceCategoryRow[],
  input: {
    amountPence: number;
    spendingCategory?: string;
    counterparty?: string;
  },
): string | null {
  const kind = input.amountPence >= 0 ? 'income' : 'expense';
  const byName = (name: string) =>
    categories.find(
      (category) => category.name === name && category.kind === kind,
    )?.id ?? null;

  if (kind === 'income') {
    return byName('Rent');
  }

  const spending = (input.spendingCategory ?? '').toUpperCase();
  if (spending.includes('REPAIR')) {
    return byName('Repairs/Maintenance');
  }

  const counterparty = (input.counterparty ?? '').toLowerCase();
  if (
    counterparty.includes('mortgage') ||
    counterparty.includes('charter court') ||
    counterparty.includes('quantum') ||
    counterparty.includes('aldermore')
  ) {
    return byName('Mortgage Interest');
  }

  if (
    counterparty.includes('payprop') ||
    counterparty.includes('agent') ||
    counterparty.includes('letting')
  ) {
    return byName('Agents Fees');
  }

  return byName('Other payments');
}
