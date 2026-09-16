import { stripHtmlToText } from '~/lib/campaigns/campaign-document';

import {
  type SurveyReportDocument,
  createSurveyReportBlockId,
} from '../survey-report-document';
import { formatEpcAddress } from './parse';
import type { EpcCertificateSummary } from './types';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function energySectionPlainText(epc: EpcCertificateSummary): string {
  const rating =
    epc.currentRating && epc.potentialRating
      ? `current band ${epc.currentRating}${
          epc.currentScore != null ? ` (${epc.currentScore})` : ''
        }, potential band ${epc.potentialRating}${
          epc.potentialScore != null ? ` (${epc.potentialScore})` : ''
        }`
      : epc.currentRating
        ? `current band ${epc.currentRating}${
            epc.currentScore != null ? ` (${epc.currentScore})` : ''
          }`
        : null;

  const parts = [
    rating
      ? `The Energy Performance Certificate on the GOV.UK register records ${rating}.`
      : 'An Energy Performance Certificate is attached from the GOV.UK register.',
    epc.certificateNumber
      ? `Certificate number ${epc.certificateNumber}.`
      : null,
    formatDate(epc.lodgementDate)
      ? `Lodged ${formatDate(epc.lodgementDate)}.`
      : null,
    epc.floorArea != null ? `Total floor area ${epc.floorArea} m².` : null,
    epc.fuelType ? `Main heating / fuel: ${epc.fuelType}.` : null,
    epc.recommendationsSummary
      ? `Recommendations recorded on the certificate: ${epc.recommendationsSummary}.`
      : null,
    'This is register data. The surveyor has not reassessed energy performance unless stated elsewhere in this report.',
  ].filter(Boolean);

  return parts.join(' ');
}

export function energySectionHtmlFromEpc(epc: EpcCertificateSummary): string {
  const paragraphs = [energySectionPlainText(epc)];
  const address = formatEpcAddress({
    addressLine1: epc.addressLine1,
    addressLine2: epc.addressLine2,
    postTown: epc.postTown,
    postcode: epc.postcode,
  });
  if (address) {
    paragraphs.unshift(`Address on the certificate: ${address}.`);
  }

  return paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join('\n');
}

export function applyEpcEnergySection(
  document: SurveyReportDocument,
  energyHtml: string,
): SurveyReportDocument {
  const html = energyHtml.trim();
  if (!html) return document;

  const headingIndex = document.blocks.findIndex(
    (block) => block.type === 'heading' && block.sectionKey === 'energy',
  );
  if (headingIndex < 0) return document;

  const next = document.blocks[headingIndex + 1];
  if (next?.type === 'text' && stripHtmlToText(next.html).length > 0) {
    return document;
  }

  const blocks = [...document.blocks];
  if (next?.type === 'text') {
    blocks[headingIndex + 1] = { ...next, html };
    return { ...document, blocks };
  }

  blocks.splice(headingIndex + 1, 0, {
    id: createSurveyReportBlockId(),
    type: 'text',
    html,
  });
  return { ...document, blocks };
}

export function epcFactsForPrompt(epc: EpcCertificateSummary): string {
  return energySectionPlainText(epc);
}
