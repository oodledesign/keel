/** Parse common UK / ISO date strings to YYYY-MM-DD. */
export function parseUkDate(value: string, hint?: string): string | null {
  const v = value.trim();
  if (!v) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);

  const dmy = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dmy) {
    const day = dmy[1]!.padStart(2, '0');
    const month = dmy[2]!.padStart(2, '0');
    let year = dmy[3]!;
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }

  if (hint?.includes('MM/DD')) {
    const mdy = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (mdy) {
      const month = mdy[1]!.padStart(2, '0');
      const day = mdy[2]!.padStart(2, '0');
      let year = mdy[3]!;
      if (year.length === 2) year = `20${year}`;
      return `${year}-${month}-${day}`;
    }
  }

  const parsed = new Date(v);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}
