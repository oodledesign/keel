export function meetingDisplayDate(
  meetingDate: string | null | undefined,
  createdAt: string,
) {
  const iso = meetingDate?.trim() || createdAt.slice(0, 10);
  const parsed = new Date(`${iso}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return new Date(createdAt).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayIsoDate() {
  return localIsoDate();
}

export function yesterdayIsoDate() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return localIsoDate(date);
}
