import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { callAI, streamAI } from '~/lib/ai/router';

export type ProposalTranscript = {
  title: string;
  content: string;
};

export type ProposalContextNote = {
  title: string;
  content: string;
  type: 'note' | 'file';
};

export type ProposalAiMeter = {
  accountId: string;
  supabase: SupabaseClient;
};

export type ProposalGenerateParams = {
  recipientName: string;
  recipientCompany?: string | null;
  accountName: string;
  senderName: string;
  transcripts: ProposalTranscript[];
  contextNotes?: ProposalContextNote[];
  referenceProposalHtml?: string | null;
  /** Total deal value in pounds (GBP), if known. */
  dealValue?: number | null;
  /** Distilled brand/personal voice block for prompt injection. */
  voicePromptBlock?: string | null;
};

export type ProposalEditParams = {
  contentHtml: string;
  instruction: string;
  recipientName?: string | null;
  accountName?: string | null;
  senderName?: string | null;
  voicePromptBlock?: string | null;
};

const PROPOSAL_SYSTEM_PROMPT = `You write UK freelance proposals for creative and professional services.

Output ONLY the proposal body as simple HTML fragments — no <!DOCTYPE>, <html>, <head>, or <body> wrapper.

Use these sections in order, each as an <h2> heading followed by <p> and/or <ul>/<li> content:
1. The Goal
2. About You
3. The Format
4. What's Included
5. Packages (only if the engagement clearly offers tiered options; otherwise omit this section)
6. Add-ons
7. Payment Plan (list milestones with percentage splits that sum to 100%)
8. Next Steps

Rules:
- British English spelling and tone: professional, warm, direct.
- Base scope and pricing on the meeting transcripts, notes/files context, and any reference proposal provided.
- Payment Plan must show clear milestone labels and percentages (e.g. "50% on signing, 50% on delivery").
- Use only h2, p, ul, li, strong, em — no tables, images, or inline styles.
- Do not invent facts not supported by the inputs; where details are missing, use sensible UK freelance defaults and keep language tentative ("typically", "we can agree").
- Do not wrap output in markdown fences.`;

function buildProposalUserPayload(params: ProposalGenerateParams) {
  const transcripts = params.transcripts
    .map(
      (t, i) =>
        `### Transcript ${i + 1}: ${t.title}\n${t.content.slice(0, 40_000)}`,
    )
    .join('\n\n');

  const contextNotes = (params.contextNotes ?? [])
    .map(
      (n, i) =>
        `### ${n.type === 'file' ? 'File' : 'Note'} ${i + 1}: ${n.title}\n${n.content.slice(0, 40_000)}`,
    )
    .join('\n\n');

  return {
    recipient_name: params.recipientName,
    recipient_company: params.recipientCompany?.trim() || null,
    workspace_name: params.accountName,
    sender_name: params.senderName,
    deal_value_gbp: params.dealValue ?? null,
    reference_proposal_html: params.referenceProposalHtml?.trim() || null,
    meeting_transcripts: transcripts || '(none provided)',
    notes_and_files_context: contextNotes || '(none provided)',
  };
}

function buildProposalSystemPrompt(voicePromptBlock?: string | null) {
  const voice = voicePromptBlock?.trim();
  if (!voice) return PROPOSAL_SYSTEM_PROMPT;
  return `${PROPOSAL_SYSTEM_PROMPT}

Match this brand / author voice when writing (keep UK freelance structure above):
${voice.slice(0, 2400)}`;
}

export async function streamProposalHtml(
  params: ProposalGenerateParams,
  meter: ProposalAiMeter,
) {
  const payload = buildProposalUserPayload(params);
  return streamAI({
    feature: 'proposal_generate',
    systemPrompt: buildProposalSystemPrompt(params.voicePromptBlock),
    userPrompt: JSON.stringify(payload),
    accountId: meter.accountId,
    supabase: meter.supabase,
  });
}

/** Non-streaming variant for server actions and one-shot generation. */
export async function generateProposalHtml(
  params: ProposalGenerateParams,
  meter: ProposalAiMeter,
): Promise<string> {
  const payload = buildProposalUserPayload(params);
  const text = await callAI({
    feature: 'proposal_generate',
    systemPrompt: buildProposalSystemPrompt(params.voicePromptBlock),
    userPrompt: JSON.stringify(payload),
    accountId: meter.accountId,
    supabase: meter.supabase,
  });
  if (!text?.trim()) {
    throw new Error('Empty proposal HTML from Anthropic');
  }
  return stripMarkdownFences(text);
}

const PROPOSAL_EDIT_SYSTEM_PROMPT = `You edit UK freelance proposal HTML for creative and professional services.

Output ONLY the revised proposal body as simple HTML fragments — no <!DOCTYPE>, <html>, <head>, or <body> wrapper.

Rules:
- Apply the user's edit instructions carefully while preserving accurate facts, pricing, and structure unless they ask to change those.
- Prefer the same section headings (h2) when they already exist; you may restructure if the instruction requires it.
- Use only h2, p, ul, li, strong, em — no tables, images, or inline styles.
- British English spelling and tone unless the voice guidance or instruction says otherwise.
- Do not invent new commercial facts not present in the draft or instruction.
- Do not wrap output in markdown fences.`;

function buildProposalEditSystemPrompt(voicePromptBlock?: string | null) {
  const voice = voicePromptBlock?.trim();
  if (!voice) return PROPOSAL_EDIT_SYSTEM_PROMPT;
  return `${PROPOSAL_EDIT_SYSTEM_PROMPT}

Match this brand / author voice when rewriting:
${voice.slice(0, 2400)}`;
}

function buildProposalEditUserPrompt(params: ProposalEditParams) {
  const instruction = params.instruction.trim();
  const contentHtml = params.contentHtml.trim();

  if (!instruction) {
    throw new Error('Edit instructions are required');
  }
  if (!contentHtml) {
    throw new Error('Proposal content is empty — generate a draft first');
  }

  return JSON.stringify({
    edit_instructions: instruction.slice(0, 4000),
    recipient_name: params.recipientName?.trim() || null,
    workspace_name: params.accountName?.trim() || null,
    sender_name: params.senderName?.trim() || null,
    current_proposal_html: contentHtml.slice(0, 120_000),
  });
}

export async function streamProposalEditHtml(
  params: ProposalEditParams,
  meter: ProposalAiMeter,
) {
  return streamAI({
    feature: 'proposal_edit',
    systemPrompt: buildProposalEditSystemPrompt(params.voicePromptBlock),
    userPrompt: buildProposalEditUserPrompt(params),
    accountId: meter.accountId,
    supabase: meter.supabase,
  });
}

export async function editProposalHtml(
  params: ProposalEditParams,
  meter: ProposalAiMeter,
): Promise<string> {
  const text = await callAI({
    feature: 'proposal_edit',
    systemPrompt: buildProposalEditSystemPrompt(params.voicePromptBlock),
    userPrompt: buildProposalEditUserPrompt(params),
    accountId: meter.accountId,
    supabase: meter.supabase,
  });
  if (!text?.trim()) {
    throw new Error('Empty proposal HTML from Anthropic');
  }
  return stripMarkdownFences(text);
}

function stripMarkdownFences(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```(?:html)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
  }
  return trimmed;
}
