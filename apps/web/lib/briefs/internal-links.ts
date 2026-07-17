import type { DomainKeyword, InternalLinkCandidate } from './types';

export function buildInternalLinkCandidates(
  domainKeywords: DomainKeyword[],
  targetKeyword: string,
): InternalLinkCandidate[] {
  const targetTokens = new Set(
    targetKeyword
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2),
  );

  return domainKeywords
    .filter((row) => row.url && row.rank > 0 && row.rank <= 30)
    .map((row) => {
      const tokens = row.keyword.toLowerCase().split(/\s+/);
      const overlap = tokens.filter((t) => targetTokens.has(t)).length;
      return { ...row, overlap };
    })
    .filter((row) => row.overlap > 0)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 15)
    .map(({ keyword, url, rank }) => ({
      keyword,
      url: url ?? '',
      rank,
    }));
}
