/** Replace Unicode characters that StandardFonts (WinAnsi) cannot encode in pdf-lib. */
const PDF_TEXT_REPLACEMENTS: Record<string, string> = {
  '\u2192': '->', // →
  '\u2190': '<-', // ←
  '\u2194': '<->', // ↔
  '\u00d7': 'x', // ×
  '\u00f7': '/', // ÷
  '\u2013': '-', // –
  '\u2014': '-', // —
  '\u2018': "'", // ‘
  '\u2019': "'", // ’
  '\u201a': "'", // ‚
  '\u201c': '"', // “
  '\u201d': '"', // ”
  '\u201e': '"', // „
  '\u2026': '...', // …
  '\u00a0': ' ', // nbsp
  '\u2022': '-', // •
  '\u00b7': '-', // ·
};

export function sanitizePdfText(input: string): string {
  let text = input.normalize('NFKC');

  for (const [from, to] of Object.entries(PDF_TEXT_REPLACEMENTS)) {
    text = text.split(from).join(to);
  }

  // WinAnsi covers ASCII + selected Latin-1; replace anything else.
  return text.replace(/[^\t\n\r\x20-\x7E\xA0-\xFF]/g, '?');
}
