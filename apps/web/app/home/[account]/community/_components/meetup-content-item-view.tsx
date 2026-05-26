'use client';

import { FileText, Link2, Youtube } from 'lucide-react';

import { YoutubeEmbed } from '~/components/youtube-embed';
import { WorkspaceRichTextHtml } from '~/components/workspace-rich-text';
import { isHtmlContent } from '~/lib/sanitize-community-html';

import type { MeetupContentItem } from '../_lib/community-schedule.types';

export function MeetupContentItemView({ item }: { item: MeetupContentItem }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-white">
        {item.kind === 'youtube' ? (
          <Youtube className="h-4 w-4 text-red-400" />
        ) : item.kind === 'link' || item.kind === 'video' ? (
          <Link2 className="h-4 w-4 text-[#5eead4]" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
        {item.title}
      </div>

      {item.kind === 'youtube' && item.url ? (
        <YoutubeEmbed url={item.url} title={item.title} />
      ) : null}

      {item.kind === 'video' && item.url ? (
        <video
          controls
          className="max-h-80 w-full rounded-xl border border-white/10"
          src={item.url}
        >
          <a href={item.url} className="text-[#5eead4] underline">
            {item.url}
          </a>
        </video>
      ) : null}

      {item.kind === 'link' && item.url ? (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[#5eead4] underline break-all"
        >
          {item.url}
        </a>
      ) : null}

      {item.body ? (
        isHtmlContent(item.body) ? (
          <WorkspaceRichTextHtml html={item.body} />
        ) : (
          <p className="whitespace-pre-wrap text-sm text-white/70">{item.body}</p>
        )
      ) : null}
    </div>
  );
}
