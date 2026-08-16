/**
 * Normalise Haiku Prep text into a clean multi-line step body.
 */
export function normalisePrepContent(raw: string): string {
  const lines = raw
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) =>
      line
        .replace(/^```.*$/g, '')
        .replace(/^["'`]+|["'`]+$/g, '')
        .replace(/^#+\s*/, '')
        .replace(/^\*\*?Prep\*\*?:?\s*/i, '')
        .replace(/^Prep:?\s*/i, '')
        .trim(),
    )
    .filter(Boolean);

  return lines.join('\n').trim();
}

export const PREP_STEP_TITLE = 'Prep';
export const PREP_STEP_SORT_ORDER = 0;
