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

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}
