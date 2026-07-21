'use client';

import { useCallback, useMemo, useState } from 'react';

import { Check, Copy, ExternalLink } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';

import { copyTextToClipboard } from '~/lib/clipboard';
import {
  buildEmbedUrl,
  buildHtml5VideoCode,
  buildIframeEmbedCode,
  buildJavaScriptEmbedCode,
  buildWebflowInstructions,
} from '~/lib/videos/embed';
import type { VideoPlayerConfigValues } from '~/lib/videos/player-config-types';

type EmbedTab = 'iframe' | 'html5' | 'javascript' | 'webflow';

export function EmbedCode(props: {
  libraryId: string;
  bunnyVideoId: string;
  cdnHostname: string;
  config: VideoPlayerConfigValues;
}) {
  const [tab, setTab] = useState<EmbedTab>('iframe');
  const [copied, setCopied] = useState(false);

  const codes = useMemo(
    () => ({
      iframe: buildIframeEmbedCode(
        props.libraryId,
        props.bunnyVideoId,
        props.config,
      ),
      html5: buildHtml5VideoCode(
        props.cdnHostname,
        props.bunnyVideoId,
        props.config,
      ),
      javascript: buildJavaScriptEmbedCode(
        props.libraryId,
        props.bunnyVideoId,
        props.config,
      ),
      webflow: buildWebflowInstructions(
        props.libraryId,
        props.bunnyVideoId,
        props.config,
      ),
    }),
    [props.libraryId, props.bunnyVideoId, props.cdnHostname, props.config],
  );

  const previewUrl = useMemo(
    () => buildEmbedUrl(props.libraryId, props.bunnyVideoId, props.config),
    [props.libraryId, props.bunnyVideoId, props.config],
  );

  const copyCode = useCallback(async () => {
    try {
      await copyTextToClipboard(codes[tab]);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [codes, tab]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Embed code</h3>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() =>
              window.open(previewUrl, '_blank', 'noopener,noreferrer')
            }
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Preview in new tab
          </Button>
          <Button
            type="button"
            size="sm"
            className="ozer-gradient-btn gap-1.5"
            onClick={() => void copyCode()}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-[var(--ozer-accent)]" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as EmbedTab)}>
        <TabsList className="flex h-auto flex-wrap gap-1 bg-[var(--workspace-shell-sidebar-accent)] p-1">
          <TabsTrigger value="iframe" className="text-xs">
            iframe
          </TabsTrigger>
          <TabsTrigger value="html5" className="text-xs">
            HTML5
          </TabsTrigger>
          <TabsTrigger value="javascript" className="text-xs">
            JavaScript
          </TabsTrigger>
          <TabsTrigger value="webflow" className="text-xs">
            Webflow
          </TabsTrigger>
        </TabsList>

        {(['iframe', 'html5', 'javascript', 'webflow'] as const).map((key) => (
          <TabsContent key={key} value={key} className="mt-3">
            <div className="overflow-x-auto rounded-lg border border-[color:var(--workspace-shell-border)] bg-[#0d1117] p-4">
              <pre className="m-0 text-xs leading-relaxed text-[#e6edf3]">
                <code className="text-[#e6edf3]">{codes[key]}</code>
              </pre>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
