import { format, parseISO } from 'date-fns';

export function formatBillingDate(iso: string | null) {
  if (!iso) {
    return '—';
  }

  try {
    return format(parseISO(iso), 'd MMM yyyy');
  } catch {
    return '—';
  }
}
