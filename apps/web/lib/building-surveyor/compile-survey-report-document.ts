import { isSafeHttpUrl } from '~/lib/campaigns/campaign-document';
import { sanitizeRichText } from '~/lib/campaigns/compile-campaign-document';

import { CONDITION_RATING_COLORS } from './condition-rating';
import {
  SURVEY_REPORT_DOCUMENT_MARKER,
  type SurveyReportBlock,
  type SurveyReportDocument,
} from './survey-report-document';

export function compileSurveyReportDocument(
  document: SurveyReportDocument,
): string {
  const parts = document.blocks
    .map((block) => renderSurveyBlock(block))
    .filter(Boolean);

  return `${SURVEY_REPORT_DOCUMENT_MARKER}\n${parts.join('\n')}`;
}

function renderSurveyBlock(block: SurveyReportBlock): string {
  switch (block.type) {
    case 'heading': {
      const tag = block.level === 1 ? 'h1' : 'h2';
      const sectionAttr = block.sectionKey
        ? ` data-section="${escapeAttr(block.sectionKey)}"`
        : '';
      const ricsAttr = block.ricsCode
        ? ` data-rics="${escapeAttr(block.ricsCode)}"`
        : '';
      const rating = block.conditionRating;
      const ratingAttr = rating ? ` data-rating="${escapeAttr(rating)}"` : '';
      const badge = rating
        ? ` <span class="survey-rating-badge" data-rating="${escapeAttr(rating)}" style="display:inline-block;width:1.35em;height:1.35em;line-height:1.35em;border-radius:999px;background:${CONDITION_RATING_COLORS[rating]};color:#fff;text-align:center;font-size:0.8em">${escapeHtml(rating)}</span>`
        : '';
      return `<${tag}${sectionAttr}${ricsAttr}${ratingAttr}>${escapeHtml(block.text)}${badge}</${tag}>`;
    }
    case 'text':
      return sanitizeRichText(block.html);
    case 'image': {
      const src = block.src.trim();
      if (!src || !isSafeHttpUrl(src)) return '';
      const caption = (block.caption ?? block.alt).trim();
      const alt = escapeAttr(block.alt || caption || 'Survey photograph');
      const img = `<img src="${escapeAttr(src)}" alt="${alt}" />`;
      if (!caption) return `<figure>${img}</figure>`;
      return `<figure>${img}<figcaption>${escapeHtml(caption)}</figcaption></figure>`;
    }
    case 'divider':
      return '<hr />';
  }
}

export function sanitizeSurveyReportHtml(html: string): string {
  if (!html?.trim()) return '';

  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(
      /<\/?(iframe|object|embed|form|svg|math|link|meta|base|applet)[^>]*>/gi,
      '',
    )
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}
