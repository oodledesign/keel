const MAX_KEYWORD_LENGTH = 500;

export function parseKeywordLines(raw: string): string[] {
  const seen = new Set<string>();
  const keywords: string[] = [];

  for (const line of raw.split('\n')) {
    const keyword = line.trim().replace(/\s+/g, ' ').slice(0, MAX_KEYWORD_LENGTH);
    if (!keyword) continue;

    const key = keyword.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    keywords.push(keyword);
  }

  return keywords;
}
