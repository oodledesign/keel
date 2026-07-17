'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Check, Copy, ExternalLink } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';

import {
  buildEmbedUrl,
  buildHtml5VideoCode,
  buildIframeEmbedCode,
  buildJavaScriptEmbedCode,
  buildWebflowInstructions,
} from '~/lib/videos/embed';
import type { VideoPlayerConfigValues } from '~/lib/videos/player-config-types';

type EmbedTab = 'iframe' | 'html5' | 'javascript' | 'webflow';

declare global {
  interface Window {
    hljs?: {
      highlightElement: (element: HTMLElement) => void;
    };
  }
}

function languageForTab(tab: EmbedTab) {
  if (tab === 'javascript') return 'javascript';
  if (tab === 'webflow') return 'plaintext';
  return 'xml';
}

export function EmbedCode(props: {
  libraryId: string;
  bunnyVideoId: string;
  cdnHostname: string;
  config: VideoPlayerConfigValues;
}) {
  const [tab, setTab] = useState<EmbedTab>('iframe');
  const [copied, setCopied] = useState(false);
  const [hljsReady, setHljsReady] = useState(false);
  const codeRef = useRef<HTMLElement | null>(null);

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

  useEffect(() => {
    if (document.querySelector('link[data-keel-hljs]')) {
      if (window.hljs) setHljsReady(true);
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href =
      'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css';
    link.setAttribute('data-keel-hljs', 'true');
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src =
      'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js';
    script.async = true;
    script.onload = () => setHljsReady(true);
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!hljsReady || !codeRef.current || !window.hljs) return;
    codeRef.current.className = languageForTab(tab);
    codeRef.current.removeAttribute('data-highlighted');
    window.hljs.highlightElement(codeRef.current);
  }, [hljsReady, codes, tab]);

  const copyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(codes[tab]);
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
              <pre className="m-0 text-xs leading-relaxed">
                <code ref={key === tab ? codeRef : undefined}>
                  {codes[key]}
                </code>
              </pre>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
