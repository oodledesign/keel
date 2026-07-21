/** Succinct date/time labels for inbox rows and message headers. */
export function formatEmailDateTime(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const time = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (sameDay) {
    return time;
  }

  const sameYear = date.getFullYear() === now.getFullYear();
  const dayMonth = date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });

  if (sameYear) {
    return `${dayMonth}, ${time}`;
  }

  const year = date.toLocaleDateString('en-GB', { year: '2-digit' });
  return `${dayMonth} '${year}`;
}
