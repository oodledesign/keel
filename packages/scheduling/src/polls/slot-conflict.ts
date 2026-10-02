/** True when the slot overlaps any busy interval (touching endpoints do not conflict). */
export function slotConflictsWithBusy(
  slot: { start: Date; end: Date },
  busy: Array<{ start: Date; end: Date }>,
): boolean {
  const start = slot.start.getTime();
  const end = slot.end.getTime();

  if (!(end > start)) {
    return false;
  }

  return busy.some((interval) => {
    const busyStart = interval.start.getTime();
    const busyEnd = interval.end.getTime();
    return (
      Number.isFinite(busyStart) &&
      Number.isFinite(busyEnd) &&
      busyEnd > start &&
      busyStart < end
    );
  });
}
