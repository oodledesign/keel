'use client';

import { useMemo, useState } from 'react';

import { Check, Copy, FileText, Sparkles } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';

import { MeetingSummaryMarkdown } from '~/components/meetings/meeting-summary-markdown';

export type PublicMeetingSpeakerSegment = {
  speaker: string;
  text: string;
};

type Props = {
  summaryText: string | null;
  content: string;
  speakerSegments: PublicMeetingSpeakerSegment[];
  panelClassName: string;
};

function buildTranscriptPlainText(
  speakerSegments: PublicMeetingSpeakerSegment[],
  content: string,
) {
  if (speakerSegments.length > 0) {
    return speakerSegments
      .map((segment) => `${segment.speaker}\n${segment.text}`)
      .join('\n\n');
  }
  return content.trim() || 'No transcript available.';
}

export function PublicMeetingNotesTabs({
  summaryText,
  content,
  speakerSegments,
  panelClassName,
}: Props) {
  const hasSummary = Boolean(summaryText?.trim());
  const [activeTab, setActiveTab] = useState(
    hasSummary ? 'summary' : 'transcript',
  );
  const [copied, setCopied] = useState(false);

  const transcriptText = useMemo(
    () => buildTranscriptPlainText(speakerSegments, content),
    [speakerSegments, content],
  );

  const copyText =
    activeTab === 'summary' && summaryText?.trim()
      ? summaryText
      : transcriptText;
  const copyLabel = activeTab === 'summary' ? 'summary' : 'transcript';

  async function handleCopy() {
    if (!copyText.trim()) return;
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className={panelClassName}>
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value);
          setCopied(false);
        }}
        className="gap-0"
      >
        <div className="mb-5 space-y-2">
          <TabsList className="h-auto w-full justify-start gap-1 rounded-xl bg-[var(--ozer-cream-50)] p-1 text-[var(--ozer-text-on-light-muted)]">
            {hasSummary ? (
              <TabsTrigger
                value="summary"
                className="gap-1.5 rounded-lg px-3 py-2 text-sm data-[state=active]:bg-white data-[state=active]:text-[var(--ozer-text-on-light)] data-[state=active]:shadow-sm"
              >
                <Sparkles className="h-3.5 w-3.5 text-[var(--ozer-accent)]" />
                Summary
              </TabsTrigger>
            ) : null}
            <TabsTrigger
              value="transcript"
              className="gap-1.5 rounded-lg px-3 py-2 text-sm data-[state=active]:bg-white data-[state=active]:text-[var(--ozer-text-on-light)] data-[state=active]:shadow-sm"
            >
              <FileText className="h-3.5 w-3.5 text-[var(--ozer-accent)]" />
              Transcript
            </TabsTrigger>
          </TabsList>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--ozer-border-on-light)] bg-[var(--ozer-cream-50)] px-2.5 py-1.5 text-xs font-medium text-[var(--ozer-plum-700)] transition-colors hover:border-[var(--ozer-accent)]/35 hover:text-[var(--ozer-accent)]"
              aria-label={copied ? `${copyLabel} copied` : `Copy ${copyLabel}`}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-[var(--ozer-accent)]" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {hasSummary && summaryText ? (
          <TabsContent value="summary" className="mt-0 outline-none">
            <MeetingSummaryMarkdown markdown={summaryText} variant="public" />
          </TabsContent>
        ) : null}

        <TabsContent value="transcript" className="mt-0 outline-none">
          <div className="max-h-[min(70vh,720px)] space-y-4 overflow-auto text-sm leading-relaxed text-[var(--ozer-text-on-light)]">
            {speakerSegments.length > 0 ? (
              speakerSegments.map((segment, index) => (
                <div key={`${segment.speaker}-${index}`}>
                  <p className="text-xs font-semibold tracking-wide text-[var(--ozer-text-on-light)] uppercase">
                    {segment.speaker}
                  </p>
                  <p className="mt-1 font-normal whitespace-pre-wrap text-[var(--ozer-plum-700)]">
                    {segment.text}
                  </p>
                </div>
              ))
            ) : (
              <p className="font-normal whitespace-pre-wrap text-[var(--ozer-plum-700)]">
                {content || 'No transcript available.'}
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
