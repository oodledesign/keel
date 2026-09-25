export function formatPollWhen(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

export function formatPollClock(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

export function formatPollDay(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso));
}

export function formatPollZoneLabel(iso: string, timeZone: string) {
  const name =
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      timeZoneName: 'short',
    })
      .formatToParts(new Date(iso))
      .find((part) => part.type === 'timeZoneName')?.value ?? timeZone;

  return `${name} (${timeZone})`;
}
