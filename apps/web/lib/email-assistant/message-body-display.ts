const QUOTE_START_PATTERNS: RegExp[] = [
  /^On .+ wrote:\s*$/m,
  /^-{2,}\s*Original Message\s*-{2,}\s*$/im,
  /^_{5,}\s*$/m,
  /^Begin forwarded message:\s*$/im,
  /^From:\s.+\n(?:Sent|Date):\s/im,
];

export function splitEmailQuotedHistory(body: string): {
  visible: string;
  quoted: string | null;
} {
  const normalized = body.replace(/\r\n/g, '\n').trimEnd();

  if (!normalized) {
    return { visible: '', quoted: null };
  }

  let cutIndex = -1;

  for (const pattern of QUOTE_START_PATTERNS) {
    const match = pattern.exec(normalized);

    if (match?.index !== undefined && match.index > 0) {
      if (cutIndex === -1 || match.index < cutIndex) {
        cutIndex = match.index;
      }
    }
  }

  const quotedBlockIndex = findQuotedBlockIndex(normalized);

  if (quotedBlockIndex !== -1) {
    if (cutIndex === -1 || quotedBlockIndex < cutIndex) {
      cutIndex = quotedBlockIndex;
    }
  }

  if (cutIndex > 0) {
    const visible = normalized.slice(0, cutIndex).trimEnd();
    const quoted = normalized.slice(cutIndex).trim();

    if (visible && quoted) {
      return { visible, quoted };
    }
  }

  return { visible: normalized, quoted: null };
}

function findQuotedBlockIndex(text: string) {
  const lines = text.split('\n');

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const previous = lines[index - 1] ?? '';

    if (previous.trim() !== '' || !line.startsWith('>')) {
      continue;
    }

    const before = lines.slice(0, index).join('\n').trim();

    if (before.length >= 20) {
      return text.indexOf(line);
    }
  }

  return -1;
}

export function previewEmailBody(body: string, maxLength = 120) {
  const { visible } = splitEmailQuotedHistory(body);
  const trimmed = visible.trim();

  if (!trimmed) {
    return '';
  }

  if (trimmed.length <= maxLength) {
    return trimmed.replace(/\s+/g, ' ');
  }

  return `${trimmed.slice(0, maxLength).replace(/\s+/g, ' ').trim()}…`;
}
