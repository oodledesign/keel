'use client';

import { useCallback, useEffect, useRef } from 'react';

import { sanitizeCommunityHtml } from '~/lib/sanitize-community-html';

/**
 * contentEditable browsers emit HTML that does not match sanitized parent
 * state (`<br>` vs `<br />`, extra wrappers). Rewriting innerHTML on that
 * echo jumps the caret to the start.
 */
export function shouldApplyExternalRichTextHtml({
  incoming,
  lastEmitted,
  currentInnerHtml,
}: {
  incoming: string;
  lastEmitted: string | null;
  currentInnerHtml: string;
}): boolean {
  const next = incoming || '';
  if (lastEmitted !== null && next === lastEmitted) return false;
  if (sanitizeCommunityHtml(currentInnerHtml) === sanitizeCommunityHtml(next)) {
    return false;
  }
  return currentInnerHtml !== next;
}

export function useControlledSanitizedHtmlEditor(
  value: string,
  onChange: (html: string) => void,
) {
  const ref = useRef<HTMLDivElement>(null);
  const lastEmittedRef = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const incoming = value || '';
    if (
      !shouldApplyExternalRichTextHtml({
        incoming,
        lastEmitted: lastEmittedRef.current,
        currentInnerHtml: el.innerHTML,
      })
    ) {
      lastEmittedRef.current = incoming;
      return;
    }
    el.innerHTML = incoming;
    lastEmittedRef.current = incoming;
  }, [value]);

  const sync = useCallback(() => {
    const html = ref.current?.innerHTML ?? '';
    const sanitized = sanitizeCommunityHtml(html);
    lastEmittedRef.current = sanitized;
    onChangeRef.current(sanitized);
  }, []);

  return { ref, sync };
}
