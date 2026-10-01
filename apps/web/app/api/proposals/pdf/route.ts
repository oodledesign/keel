import { NextResponse } from 'next/server';

import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { buildProposalPdf } from '~/home/[account]/proposals/_lib/server/proposal-pdf';
import { createSurveyTemplatesService } from '~/home/[account]/surveys/_lib/server/survey-templates.service';
import { loadAccountBrandResolved } from '~/lib/brand/account-brand';
import {
  isCoverImagePath,
  parseCoverFocus,
} from '~/lib/building-surveyor/survey-cover';
import {
  loadSurveyPdfArt,
  loadSurveyPdfFonts,
  normalizeSurveyPhoto,
} from '~/lib/building-surveyor/survey-pdf-assets.server';
import { signSurveyPhotoUrls } from '~/lib/building-surveyor/survey-photo-urls';
import {
  SURVEYOR_PROFILE_SELECT,
  formatReportDate,
  mapSurveyorProfileRow,
} from '~/lib/building-surveyor/survey-report-details';
import {
  isSafeHttpUrl,
  parseSurveyReportDocument,
} from '~/lib/building-surveyor/survey-report-document';
import {
  buildingSurveyTypeLabel,
  isSurveyLevel,
  normalizeBuildingSurveyType,
  surveyLevelFromType,
} from '~/lib/building-surveyor/survey-types';

export const maxDuration = 60;

const PHOTO_FETCH_CONCURRENCY = 6;

function surveyReportMeta(proposal: Record<string, unknown>) {
  const surveyType = (proposal.survey_type as string | null) ?? null;
  const isHomeSurvey = !surveyType || surveyType.startsWith('rics_hss');
  const storedLevel = proposal.survey_level as number | null;
  const level = isSurveyLevel(storedLevel)
    ? storedLevel
    : surveyLevelFromType(surveyType);
  const address = [
    (proposal.survey_property_address as string | null)?.trim(),
    (proposal.survey_property_postcode as string | null)?.trim(),
  ]
    .filter(Boolean)
    .join(', ');

  return {
    survey_level: isHomeSurvey ? level : null,
    survey_report_label: isHomeSurvey
      ? `RICS Home Survey - Level ${level}`
      : buildingSurveyTypeLabel(surveyType),
    survey_property_address: address || null,
    report_date:
      (proposal.sent_at as string | null) ??
      (proposal.updated_at as string | null) ??
      null,
    inspection_date:
      formatReportDate(
        (proposal.survey_inspection_date as string | null) ?? null,
      ) || null,
    draft: proposal.status === 'draft',
  };
}

/**
 * The front-cover photo: the survey's chosen building photo, else the
 * workspace default image. Null leaves the PDF to fall back to the first
 * report photo.
 */
async function loadCoverImage(
  proposal: Record<string, unknown>,
  accountId: string,
) {
  const admin = getSupabaseServerAdminClient();
  // Cover columns may lag generated Database types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const photoDocId =
    (proposal.survey_cover_photo_doc_id as string | null) ?? null;
  if (photoDocId) {
    const { data: row } = await db
      .from('docs')
      .select('id, file_path, storage_path, storage_bucket')
      .eq('id', photoDocId)
      .eq('account_id', accountId)
      .maybeSingle();
    if (row) {
      const signed = await signSurveyPhotoUrls(admin, [
        {
          id: row.id as string,
          filePath: (row.file_path as string | null) ?? null,
          storagePath: (row.storage_path as string | null) ?? null,
          storageBucket: (row.storage_bucket as string | null) ?? null,
        },
      ]);
      const url = signed[row.id as string];
      const image = url ? await fetchPhoto(url) : null;
      if (image) return image;
    }
  }

  const { data: settings } = await db
    .from('survey_account_settings')
    .select('cover_image_path')
    .eq('account_id', accountId)
    .maybeSingle();
  const defaultPath =
    (settings as { cover_image_path?: string | null } | null)
      ?.cover_image_path ?? null;
  if (!defaultPath || !isCoverImagePath(accountId, defaultPath)) return null;

  const signed = await signSurveyPhotoUrls(admin, [
    { id: 'default-cover', filePath: defaultPath },
  ]);
  const url = signed['default-cover'];
  return url ? fetchPhoto(url) : null;
}

async function surveyReportExtras(
  proposal: Record<string, unknown>,
  accountId: string,
) {
  const admin = getSupabaseServerAdminClient();
  // surveyor_profiles may lag generated Database types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const createdBy = (proposal.created_by as string | null) ?? null;
  const [template, profileResult, fonts, art, coverImage] = await Promise.all([
    createSurveyTemplatesService(admin)
      .resolveForSurvey({
        accountId,
        surveyType: normalizeBuildingSurveyType(
          (proposal.survey_type as string | null) ?? null,
        ),
        templateId: (proposal.survey_template_id as string | null) ?? null,
      })
      .catch(() => null),
    createdBy
      ? db
          .from('surveyor_profiles')
          .select(SURVEYOR_PROFILE_SELECT)
          .eq('account_id', accountId)
          .eq('user_id', createdBy)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    loadSurveyPdfFonts(),
    loadSurveyPdfArt(),
    loadCoverImage(proposal, accountId).catch(() => null),
  ]);
  const profile = profileResult.data
    ? mapSurveyorProfileRow(profileResult.data)
    : null;
  const showRicsLogo = template?.brand?.showRicsLogo !== false;

  return {
    surveyor_name: profile?.displayName || null,
    surveyor_rics_number: profile?.ricsNumber || null,
    survey_fonts: fonts,
    rics_logo: showRicsLogo ? art.ricsLogo : null,
    survey_cover_image: coverImage,
    survey_cover_focus: parseCoverFocus(proposal.survey_cover_focus),
    survey_assets: { 'typical-house': art.typicalHouse },
  };
}

function pdfFilename(proposal: Record<string, unknown>): string {
  const prefix =
    proposal.kind === 'survey_report' ? 'survey-report' : 'proposal';
  const title = ((proposal.title as string | null) ?? 'document')
    .replace(/[^\w-]+/g, '-')
    .slice(0, 40);
  return `${prefix}-${title}.pdf`;
}

async function buildPayload(
  proposal: Record<string, unknown>,
  accountId: string,
) {
  const client = getSupabaseServerAdminClient();
  const [{ data: clientRow }, brand, { data: account }] = await Promise.all([
    proposal.client_id
      ? client
          .from('clients')
          .select('display_name, first_name, last_name, company_name, email')
          .eq('id', proposal.client_id as string)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    loadAccountBrandResolved(accountId),
    client.from('accounts').select('name').eq('id', accountId).maybeSingle(),
  ]);

  const kind = (proposal.kind as string | null) ?? 'proposal';
  const document =
    kind === 'survey_report'
      ? parseSurveyReportDocument(proposal.body_document)
      : null;
  const [imageBytesById, extras] = await Promise.all([
    document ? loadSurveyImageBytes(accountId, document) : {},
    kind === 'survey_report'
      ? surveyReportExtras(proposal, accountId)
      : Promise.resolve(null),
  ]);

  return {
    title: (proposal.title as string) ?? 'Proposal',
    status: (proposal.status as string) ?? 'draft',
    content_html: (proposal.content_html as string) ?? '',
    kind,
    body_document: proposal.body_document,
    total_pence: proposal.total_pence as number | null,
    currency: (proposal.currency as string) ?? 'gbp',
    expires_at: proposal.expires_at as string | null,
    recipient_name: proposal.recipient_name as string | null,
    brand_name: account?.name ?? null,
    brand_logo_url: brand.logo_url,
    brand_primary_color: brand.primary_color,
    ...(kind === 'survey_report' ? surveyReportMeta(proposal) : {}),
    ...(extras ?? {}),
    imageBytesById,
    client: clientRow ?? null,
  };
}

async function loadSurveyImageBytes(
  accountId: string,
  document: NonNullable<ReturnType<typeof parseSurveyReportDocument>>,
) {
  const admin = getSupabaseServerAdminClient();
  const imageBlocks = document.blocks.filter((block) => block.type === 'image');
  const documentIds = imageBlocks
    .map((block) => (block.type === 'image' ? block.documentId : null))
    .filter((id): id is string => Boolean(id));

  const sources: Array<{
    id: string;
    filePath?: string | null;
    storagePath?: string | null;
    storageBucket?: string | null;
  }> = [];

  if (documentIds.length > 0) {
    // file_path / proposal photos may lag generated Database types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = admin as any;
    const { data: rows } = await db
      .from('docs')
      .select('id, file_path, storage_path, storage_bucket')
      .eq('account_id', accountId)
      .in('id', documentIds);

    for (const row of (rows ?? []) as Array<Record<string, unknown>>) {
      sources.push({
        id: row.id as string,
        filePath: (row.file_path as string | null) ?? null,
        storagePath: (row.storage_path as string | null) ?? null,
        storageBucket: (row.storage_bucket as string | null) ?? null,
      });
    }
  }

  const signed = await signSurveyPhotoUrls(admin, sources);
  const bytes: Record<string, Uint8Array> = {};

  const queue = [...imageBlocks];
  const worker = async () => {
    for (let block = queue.shift(); block; block = queue.shift()) {
      if (block.type !== 'image') continue;
      const url =
        (block.documentId ? signed[block.documentId] : null) ?? block.src;
      if (!url || !isSafeHttpUrl(url)) continue;
      const image = await fetchPhoto(url);
      if (!image) continue;
      if (block.documentId) bytes[block.documentId] = image.bytes;
      bytes[block.src] = image.bytes;
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(PHOTO_FETCH_CONCURRENCY, queue.length) },
      worker,
    ),
  );

  return bytes;
}

async function fetchPhoto(url: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const raw = new Uint8Array(await response.arrayBuffer());
    const normalized = await normalizeSurveyPhoto(raw);
    if (normalized) return normalized;
    const isPng = raw[0] === 0x89 && raw[1] === 0x50;
    const isJpg = raw[0] === 0xff && raw[1] === 0xd8;
    if (!isPng && !isJpg) return null;
    return { bytes: raw, kind: isPng ? ('png' as const) : ('jpg' as const) };
  } catch {
    return null;
  }
}

/**
 * GET /api/proposals/pdf?token=xxx  — Portal: load by public token, no auth.
 * GET /api/proposals/pdf?proposalId=xxx — Dashboard: auth required, RLS applies.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const proposalId = searchParams.get('proposalId');

  if (token) {
    const client = getSupabaseServerAdminClient();
    const { data: proposal, error: proposalError } = await client
      .from('proposals')
      .select('*')
      .eq('public_token', token)
      .maybeSingle();

    if (proposalError || !proposal) {
      return NextResponse.json(
        { error: 'Proposal not found' },
        { status: 404 },
      );
    }

    const payload = await buildPayload(proposal, proposal.account_id);
    const pdfBytes = await buildProposalPdf(payload);
    const filename = pdfFilename(proposal);
    const body = Buffer.from(pdfBytes);
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(body.length),
      },
    });
  }

  if (proposalId) {
    const client = getSupabaseServerClient();
    const auth = await requireUser(client);

    if (!auth.data) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: proposal, error: invError } = await client
      .from('proposals')
      .select('*')
      .eq('id', proposalId)
      .single();
    if (invError || !proposal) {
      return NextResponse.json(
        { error: 'Proposal not found' },
        { status: 404 },
      );
    }

    const payload = await buildPayload(proposal, proposal.account_id);
    const pdfBytes = await buildProposalPdf(payload);
    const filename = pdfFilename(proposal);
    const body = Buffer.from(pdfBytes);
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(body.length),
      },
    });
  }

  return NextResponse.json(
    { error: 'Provide token or proposalId' },
    { status: 400 },
  );
}
