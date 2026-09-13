export type ShoppingExportItem = {
  display_text: string;
  category?: string;
  checked?: boolean;
  in_pantry?: boolean;
  excluded?: boolean;
};

const CATEGORY_LABELS: Record<string, string> = {
  produce: 'Produce',
  meat_fish: 'Meat/fish',
  dairy: 'Dairy',
  store_cupboard: 'Store cupboard',
  other: 'Other',
};

function visibleItems(items: ShoppingExportItem[]): ShoppingExportItem[] {
  return items.filter((item) => !item.excluded);
}

export function formatShoppingListPlainText(
  items: ShoppingExportItem[],
): string {
  const rows = visibleItems(items);
  if (rows.length === 0) return '';

  const groups = new Map<string, ShoppingExportItem[]>();
  for (const item of rows) {
    const key = item.category ?? 'other';
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  const lines: string[] = [];
  for (const [category, group] of groups) {
    const label = CATEGORY_LABELS[category] ?? 'Other';
    if (lines.length > 0) lines.push('');
    lines.push(label);
    for (const item of group) {
      const mark = item.checked ? '[x]' : item.in_pantry ? '[have]' : '[ ]';
      lines.push(`${mark} ${item.display_text}`);
    }
  }
  return lines.join('\n');
}

export function formatShoppingListCsv(items: ShoppingExportItem[]): string {
  const rows = visibleItems(items);
  const header = 'category,item,status';
  const escape = (value: string) => {
    if (/[",\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const body = rows.map((item) => {
    const category = CATEGORY_LABELS[item.category ?? 'other'] ?? 'Other';
    const status = item.checked
      ? 'bought'
      : item.in_pantry
        ? 'in pantry'
        : 'need';
    return [escape(category), escape(item.display_text), escape(status)].join(
      ',',
    );
  });

  return [header, ...body].join('\n');
}

export function downloadTextFile(filename: string, contents: string) {
  const blob = new Blob([contents], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 150);
}
