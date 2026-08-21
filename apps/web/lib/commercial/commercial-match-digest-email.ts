/**
 * Pure HTML helpers for the commercial match digest email.
 * Kept free of `server-only` so unit tests can import it.
 */

export type DigestEmailMatch = {
  listingId: string;
  listingName: string;
  requirementLabel: string;
  score: number;
  listingCoverUrl?: string | null;
};

export type DigestListingGroup = {
  listingId: string;
  listingName: string;
  listingCoverUrl: string | null;
  matches: Array<{ requirementLabel: string; score: number }>;
};

/** How many distinct properties to render in the email body. */
export const DIGEST_EMAIL_MAX_LISTINGS = 8;

/** How many requirement rows under each property. */
export const DIGEST_EMAIL_MAX_MATCHES_PER_LISTING = 5;

export function matchScoreStrength(score: number): 'strong' | 'medium' | 'low' {
  if (score >= 75) return 'strong';
  if (score >= 55) return 'medium';
  return 'low';
}

/** Email-safe pill colours by match strength (green = strong). */
export function matchScorePillColors(score: number): {
  background: string;
  color: string;
} {
  switch (matchScoreStrength(score)) {
    case 'strong':
      return { background: '#E6F4EA', color: '#1B7A3D' };
    case 'medium':
      return { background: '#FBF0D2', color: '#8A6D1D' };
    default:
      return { background: '#F0E8E4', color: '#5A4450' };
  }
}

export function groupDigestMatchesByListing(
  suggestions: DigestEmailMatch[],
): DigestListingGroup[] {
  const groups = new Map<string, DigestListingGroup>();

  for (const suggestion of suggestions) {
    const existing = groups.get(suggestion.listingId);
    if (!existing) {
      groups.set(suggestion.listingId, {
        listingId: suggestion.listingId,
        listingName: suggestion.listingName,
        listingCoverUrl: suggestion.listingCoverUrl?.trim() || null,
        matches: [
          {
            requirementLabel: suggestion.requirementLabel,
            score: suggestion.score,
          },
        ],
      });
      continue;
    }

    if (!existing.listingCoverUrl && suggestion.listingCoverUrl?.trim()) {
      existing.listingCoverUrl = suggestion.listingCoverUrl.trim();
    }
    existing.matches.push({
      requirementLabel: suggestion.requirementLabel,
      score: suggestion.score,
    });
  }

  for (const group of groups.values()) {
    group.matches.sort((a, b) => b.score - a.score);
  }

  // Preserve first-seen order (suggestions are already score-desc).
  return [...groups.values()];
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderScorePill(score: number) {
  const { background, color } = matchScorePillColors(score);
  return `<span style="display:inline-block;background:${background};color:${color};font-size:12px;font-weight:700;line-height:1;padding:5px 8px;border-radius:999px;white-space:nowrap;">${score}%</span>`;
}

function renderListingThumb(coverUrl: string | null, listingName: string) {
  const alt = escapeHtml(listingName);
  if (coverUrl) {
    return `<img src="${escapeHtml(coverUrl)}" alt="${alt}" width="48" height="48" style="display:block;width:48px;height:48px;border-radius:8px;object-fit:cover;border:1px solid #E7DECF;" />`;
  }

  const initial = escapeHtml(
    (listingName.trim().charAt(0) || '?').toUpperCase(),
  );
  return `<div style="width:48px;height:48px;border-radius:8px;background:#F0E8E4;border:1px solid #E7DECF;color:#5A4450;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;line-height:48px;text-align:center;">${initial}</div>`;
}

function renderListingGroup(group: DigestListingGroup) {
  const matchRows = group.matches
    .slice(0, DIGEST_EMAIL_MAX_MATCHES_PER_LISTING)
    .map((match) => {
      return `
<tr>
  <td style="padding:4px 0 4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.4;color:#2A1720;">
    ${escapeHtml(match.requirementLabel)}
  </td>
  <td align="right" style="padding:4px 0 4px 12px;vertical-align:middle;white-space:nowrap;">
    ${renderScorePill(match.score)}
  </td>
</tr>`.trim();
    })
    .join('');

  const hidden = group.matches.length - DIGEST_EMAIL_MAX_MATCHES_PER_LISTING;
  const moreMatches =
    hidden > 0
      ? `<tr><td colspan="2" style="padding:2px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:#5A4450;">+${hidden} more for this property</td></tr>`
      : '';

  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;margin:0 0 16px;border:1px solid #E7DECF;border-radius:12px;background:#FFFFFF;">
  <tr>
    <td style="padding:12px 14px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;">
        <tr>
          <td width="48" valign="top" style="width:48px;padding:0 12px 0 0;">
            ${renderListingThumb(group.listingCoverUrl, group.listingName)}
          </td>
          <td valign="top" style="padding:0;">
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;line-height:1.3;color:#2A1720;margin:0 0 8px;">
              ${escapeHtml(group.listingName)}
            </div>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;">
              ${matchRows}
              ${moreMatches}
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim();
}

export function buildCommercialMatchDigestBodyHtml(input: {
  accountName: string;
  totalCount: number;
  suggestions: DigestEmailMatch[];
  viewAllHref: string;
  productName?: string;
}): {
  html: string;
  renderedPairCount: number;
  renderedListingCount: number;
} {
  const productName = input.productName?.trim() || 'Ozer';
  const groups = groupDigestMatchesByListing(input.suggestions).slice(
    0,
    DIGEST_EMAIL_MAX_LISTINGS,
  );

  let renderedPairCount = 0;
  for (const group of groups) {
    renderedPairCount += Math.min(
      group.matches.length,
      DIGEST_EMAIL_MAX_MATCHES_PER_LISTING,
    );
  }

  const listingBlocks = groups.map(renderListingGroup).join('');

  const hiddenPairs = Math.max(0, input.totalCount - renderedPairCount);
  const viewAll =
    input.totalCount > renderedPairCount
      ? `<p style="margin:4px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;">
          <a href="${escapeHtml(input.viewAllHref)}" style="color:#FF5C34;font-weight:700;text-decoration:none;">View all ${input.totalCount} matches →</a>
          ${
            hiddenPairs > 0
              ? `<span style="color:#5A4450;"> · ${hiddenPairs} more not shown here</span>`
              : ''
          }
        </p>`
      : `<p style="margin:4px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;">
          <a href="${escapeHtml(input.viewAllHref)}" style="color:#FF5C34;font-weight:700;text-decoration:none;">Open matches in ${escapeHtml(productName)} →</a>
        </p>`;

  const html = `
<p style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#2A1720;">
  ${escapeHtml(input.accountName)} has <strong>${input.totalCount}</strong> open match suggestion${
    input.totalCount === 1 ? '' : 's'
  } across active stock and requirements.
</p>
${listingBlocks}
${viewAll}
`.trim();

  return {
    html,
    renderedPairCount,
    renderedListingCount: groups.length,
  };
}
