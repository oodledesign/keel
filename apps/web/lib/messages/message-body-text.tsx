import { Fragment } from 'react';

import { cn } from '@kit/ui/utils';

const URL_REGEX =
  /(\b(?:https?:\/\/|www\.)[^\s<]+[^\s<.,:;"')\]}])/gi;

type MessageBodyPart =
  | { type: 'text'; value: string }
  | { type: 'link'; value: string; href: string };

function normalizeHref(url: string) {
  return url.startsWith('www.') ? `https://${url}` : url;
}

function splitMessageBody(text: string): MessageBodyPart[] {
  const parts: MessageBodyPart[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_REGEX)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, index) });
    }
    const url = match[0];
    parts.push({ type: 'link', value: url, href: normalizeHref(url) });
    lastIndex = index + url.length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: 'text', value: text }];
}

export function MessageBodyText({
  text,
  className,
  linkClassName,
}: {
  text: string;
  className?: string;
  linkClassName?: string;
}) {
  const parts = splitMessageBody(text);

  return (
    <p className={cn('whitespace-pre-wrap break-words leading-snug', className)}>
      {parts.map((part, index) =>
        part.type === 'link' ? (
          <a
            key={`${part.href}-${index}`}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'underline decoration-current/40 underline-offset-2 hover:decoration-current/80',
              linkClassName,
            )}
          >
            {part.value}
          </a>
        ) : (
          <Fragment key={index}>{part.value}</Fragment>
        ),
      )}
    </p>
  );
}
