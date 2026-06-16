export type SonioxTranscriptToken = {
  text: string;
  is_final?: boolean;
  speaker?: string;
};

function normalizeTokenText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return '';
  }

  return trimmed.replace(/^\s+/, (leading) => {
    if (leading.includes('\n')) {
      return leading;
    }
    return ' ';
  });
}

export function formatSonioxTokens(
  tokens: SonioxTranscriptToken[],
  options?: { includePartial?: boolean; labelSpeakers?: boolean },
) {
  const includePartial = options?.includePartial ?? false;
  const labelSpeakers = options?.labelSpeakers ?? true;

  let transcript = '';
  let currentSpeaker: string | undefined;

  for (const token of tokens) {
    if (!includePartial && token.is_final === false) {
      continue;
    }

    const text = normalizeTokenText(token.text);
    if (!text) {
      continue;
    }

    if (
      labelSpeakers &&
      token.speaker &&
      token.speaker !== currentSpeaker
    ) {
      currentSpeaker = token.speaker;
      if (transcript.length > 0) {
        transcript += '\n\n';
      }
      transcript += `Speaker ${token.speaker}: `;
    }

    transcript += text;
  }

  return transcript.trim();
}
