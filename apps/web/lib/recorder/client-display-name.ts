export function clientDisplayName(row: {
  display_name?: string | null;
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}) {
  return (
    row.display_name?.trim() ||
    row.company_name?.trim() ||
    [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
    'Unnamed client'
  );
}
