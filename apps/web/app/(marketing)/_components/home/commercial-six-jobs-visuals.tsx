'use client';

import Image from 'next/image';

import { ExternalLink, FileText, Mail } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import { PublishPortalsMock } from '~/(marketing)/_components/feature-tour-commercial-mocks';
import {
  COMMERCIAL_AI_PILLS,
  COMMERCIAL_HOME_PUBLISH_PORTALS,
} from '~/lib/marketing/commercial-home-content';

export function PortalsVisual() {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-[#2A1720]/15 bg-white p-5 text-[#2A1720] shadow-sm">
        <PublishPortalsMock />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-6 rounded-xl bg-white/40 px-4 py-2.5 backdrop-blur-sm">
        {COMMERCIAL_HOME_PUBLISH_PORTALS.map((portal) => (
          <div key={portal.name} className="flex items-center gap-2">
            <div className="relative h-5 w-5 overflow-hidden rounded">
              <Image
                src={portal.logoSrc}
                alt={portal.name}
                fill
                className="object-contain"
                sizes="20px"
              />
            </div>
            <span className="text-xs font-semibold text-[#2A1720]">
              {portal.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RequirementsVisual() {
  const rows = [
    {
      party: 'Apex Logistics Ltd',
      requirement: '2,000–4,000 sq ft industrial',
      score: '94%',
      status: 'Viewing booked',
      statusClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    },
    {
      party: 'Meridian Retail Group',
      requirement: '1,500 sq ft retail / E-class',
      score: '88%',
      status: 'Terms issuing',
      statusClass: 'bg-sky-100 text-sky-900 border-sky-300',
    },
    {
      party: 'Kent Trade Counters',
      requirement: 'Trade counter with yard',
      score: '81%',
      status: 'Shortlisted',
      statusClass: 'bg-amber-100 text-amber-900 border-amber-300',
    },
  ];

  return (
    <div className="rounded-2xl border border-[#2A1720]/15 bg-white p-5 text-[#2A1720] shadow-sm">
      <div className="mb-4 flex items-center justify-between border-b border-[#2A1720]/10 pb-3">
        <div>
          <p className="text-xs font-bold tracking-wider text-[#2A1720]/60 uppercase">
            Interest schedule
          </p>
          <p className="text-sm font-semibold text-[#2A1720]">
            Unit 4, Riverside Park
          </p>
        </div>
        <span className="rounded-full bg-[#FF5C34]/15 px-2.5 py-0.5 text-xs font-semibold text-[#FF5C34]">
          3 active parties
        </span>
      </div>

      <div className="space-y-2.5">
        {rows.map((row) => (
          <div
            key={row.party}
            className="flex flex-col gap-2 rounded-xl border border-[#2A1720]/10 bg-[#FBF6EC]/50 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-[#2A1720]">
                {row.party}
              </p>
              <p className="truncate text-xs text-[#2A1720]/80">
                {row.requirement}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#2A1720] px-2 py-0.5 font-mono text-xs font-bold text-[#FBF6EC]">
                {row.score} fit
              </span>
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-xs font-medium',
                  row.statusClass,
                )}
              >
                {row.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CirculationVisual() {
  return (
    <div className="rounded-2xl border border-[#2A1720]/15 bg-white p-5 text-[#2A1720] shadow-sm">
      <div className="mb-4 flex items-center gap-2 border-b border-[#2A1720]/10 pb-3">
        <div className="flex size-7 items-center justify-center rounded-lg bg-[#2A1720] text-[#FBF6EC]">
          <Mail className="size-3.5" />
        </div>
        <div>
          <p className="text-xs font-bold text-[#2A1720]">
            Match digest · New instruction
          </p>
          <p className="text-xs text-[#2A1720]/80">
            Automatically sent to matching registered applicants
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="rounded-xl border border-[#2A1720]/10 bg-[#F7F9C8]/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-[#2A1720]">
              Unit 4, Riverside Park
            </span>
            <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-xs font-bold text-white">
              94% fit
            </span>
          </div>
          <p className="mt-1 text-xs text-[#2A1720]/80">
            2,450 sq ft · Industrial / Warehouse · £28,500 pax
          </p>
        </div>

        <div className="rounded-xl border border-[#2A1720]/10 bg-[#F7F9C8]/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-[#2A1720]">
              Unit 7, Bridge Road Trade Park
            </span>
            <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-xs font-bold text-white">
              88% fit
            </span>
          </div>
          <p className="mt-1 text-xs text-[#2A1720]/80">
            3,100 sq ft · Trade counter · £36,000 pax
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between pt-1 text-xs text-[#2A1720]/80">
        <span>Sent via workspace sending domain</span>
        <span className="font-semibold text-emerald-800">
          Unsubscribe handled
        </span>
      </div>
    </div>
  );
}

export function PipelineVisual() {
  return (
    <div className="relative mx-auto w-full max-w-lg">
      <div className="overflow-hidden rounded-2xl border border-[#0C2438]/20 bg-white shadow-md">
        <Image
          src="/brand/marketing/commercial-pipeline-board.png"
          alt="Ozer commercial pipeline board showing instructions across stages with fee totals"
          width={1140}
          height={1018}
          className="h-auto w-full object-cover"
          sizes="(max-width: 768px) 100vw, 520px"
        />
      </div>

      <div className="absolute -right-2 -bottom-4 w-1/2 max-w-[260px] min-w-[200px] overflow-hidden rounded-xl border border-[#0C2438]/25 bg-white p-1 shadow-xl sm:-right-4 sm:-bottom-6">
        <Image
          src="/brand/marketing/commercial-agency-insights.png"
          alt="Commercial agency fee insights by stage and period"
          width={800}
          height={500}
          className="h-auto w-full rounded-lg object-contain"
          sizes="260px"
        />
      </div>
    </div>
  );
}

export function BrochuresVisual({
  onOpenSample,
}: {
  onOpenSample?: () => void;
}) {
  return (
    <div className="relative mx-auto w-full max-w-lg">
      <div className="overflow-hidden rounded-2xl border border-[#1F2B1A]/20 bg-white shadow-md">
        <Image
          src="/brand/marketing/commercial-agency-desk.jpg"
          alt="Online commercial property brochure presented as an interactive slideshow"
          width={1200}
          height={614}
          className="h-auto w-full object-cover"
          sizes="(max-width: 768px) 100vw, 520px"
        />
      </div>

      {/* PDF thumbnail mock overlapping */}
      <div className="absolute -top-3 -left-2 w-32 rounded-xl border border-[#1F2B1A]/20 bg-white p-2.5 shadow-lg sm:-top-4 sm:-left-4 sm:w-40">
        <div className="flex items-center gap-1.5 border-b border-[#1F2B1A]/10 pb-1.5">
          <FileText className="size-3 text-[#FF5C34]" />
          <span className="text-xs font-bold text-[#1F2B1A]">
            PDF Particulars
          </span>
        </div>
        <div className="mt-1.5 space-y-1">
          <div className="h-1.5 w-3/4 rounded bg-[#1F2B1A]/20" />
          <div className="h-1 w-full rounded bg-[#1F2B1A]/10" />
          <div className="h-1 w-5/6 rounded bg-[#1F2B1A]/10" />
        </div>
        <div className="mt-2 text-right">
          <span className="text-xs font-semibold text-[#1F2B1A]/80">
            A4 Print & Email
          </span>
        </div>
      </div>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={onOpenSample}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#1F2B1A] px-4 py-2 text-xs font-semibold text-[#E4E8DC] transition-opacity hover:opacity-90"
          aria-label="View a live brochure (opens in new tab)"
        >
          View a live brochure
          <ExternalLink className="size-3" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function AiVisual() {
  return (
    <div className="flex flex-col gap-2.5">
      {COMMERCIAL_AI_PILLS.map((pill) => {
        const isWasabi = pill.accent === 'wasabi';
        return (
          <div
            key={pill.bold}
            className={cn(
              'flex flex-col gap-0.5 rounded-full border px-4 py-2.5 transition-transform sm:flex-row sm:items-baseline sm:gap-2',
              isWasabi
                ? 'border-[#E9F056] bg-[#F7F9C8] text-[#2A1720]'
                : 'border-[#AEB8A0] bg-[#E4E8DC] text-[#2A1720]',
            )}
          >
            <span className="text-xs font-bold whitespace-nowrap">
              {pill.bold}
            </span>
            <span className="hidden text-xs text-[#2A1720]/40 sm:inline">
              ·
            </span>
            <span className="text-xs text-[#2A1720]/80">{pill.line}</span>
          </div>
        );
      })}
    </div>
  );
}
