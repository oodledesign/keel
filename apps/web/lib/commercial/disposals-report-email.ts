/**
 * Body of the scheduled availability email. Pure: an email-safe table with
 * inline styles (email clients ignore stylesheets) that mirrors the print view.
 */
import { type ExportTextTable, escapeHtml } from './disposals-export';

/** Beyond this the table is cut short; the attachments hold every row. */
export const REPORT_EMAIL_MAX_ROWS = 150;

const TONE_BACKGROUND = {
  new: '#dcfce7',
  changed: '#fef3c7',
  removed: '#f3f4f6',
} as const;

const CELL =
  'padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;line-height:1.4;vertical-align:top;';

export function renderReportEmailBody(
  table: ExportTextTable,
  options: {
    /** Names of the files attached, shown as a hint under the table. */
    attachmentNames: string[];
    maxRows?: number;
  },
): string {
  const maxRows = options.maxRows ?? REPORT_EMAIL_MAX_ROWS;
  const columnCount = table.columns.length;
  let remaining = maxRows;
  let truncated = false;

  const head = table.columns
    .map(
      (column) =>
        `<th align="left" style="${CELL}background:#f3f4f6;font-weight:600;">${escapeHtml(column.label)}</th>`,
    )
    .join('');

  const bodyRows: string[] = [];
  for (const group of table.groups) {
    if (remaining <= 0) {
      truncated = true;
      break;
    }
    if (group.label) {
      bodyRows.push(
        `<tr><td colspan="${columnCount}" style="${CELL}background:#e5e7eb;font-weight:600;">${escapeHtml(group.label)}</td></tr>`,
      );
    }
    group.rows.forEach((row, index) => {
      if (remaining <= 0) {
        truncated = true;
        return;
      }
      remaining -= 1;
      const tone = group.tones?.[index] ?? null;
      const background = tone ? `background:${TONE_BACKGROUND[tone]};` : '';
      const cells = row
        .map(
          (cell) =>
            `<td style="${CELL}${background}">${escapeHtml(cell).replace(/\n/g, '<br>')}</td>`,
        )
        .join('');
      bodyRows.push(`<tr>${cells}</tr>`);
    });
  }

  const summary = table.changeSummary
    ? `<p style="margin:0 0 12px;font-size:14px;"><strong>Since the last report:</strong> ${escapeHtml(table.changeSummary)}.</p>`
    : '';
  const legend = table.changeSummary
    ? '<p style="margin:0 0 12px;font-size:12px;color:#6b7280;">Green rows are new, amber rows have changed, grey rows have left the list.</p>'
    : '';
  const filters =
    table.filters.length > 0
      ? `<p style="margin:0 0 12px;font-size:12px;color:#6b7280;">${escapeHtml(table.filters.join('  |  '))}</p>`
      : '';
  const attachments =
    options.attachmentNames.length > 0
      ? `<p style="margin:12px 0 0;font-size:12px;color:#6b7280;">${truncated ? `Showing the first ${maxRows} rows. ` : ''}Attached: ${escapeHtml(options.attachmentNames.join(', '))}.</p>`
      : truncated
        ? `<p style="margin:12px 0 0;font-size:12px;color:#6b7280;">Showing the first ${maxRows} rows only.</p>`
        : '';

  return `${summary}${legend}${filters}<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;"><thead><tr>${head}</tr></thead><tbody>${bodyRows.join('')}</tbody></table>${attachments}`;
}
