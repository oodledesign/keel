/**
 * UK tax/financial year runs 6 April – 5 April. Returns labels like "2024/25",
 * most recent first.
 */
export function generateFinancialYearOptions(
  yearsBack = 8,
  yearsForward = 1,
): string[] {
  const now = new Date();
  const currentFyStartYear =
    now.getMonth() > 3 || (now.getMonth() === 3 && now.getDate() >= 6)
      ? now.getFullYear()
      : now.getFullYear() - 1;

  const options: string[] = [];
  for (let offset = yearsForward; offset >= -yearsBack; offset--) {
    const startYear = currentFyStartYear + offset;
    const endYearShort = String((startYear + 1) % 100).padStart(2, '0');
    options.push(`${startYear}/${endYearShort}`);
  }
  return options;
}
