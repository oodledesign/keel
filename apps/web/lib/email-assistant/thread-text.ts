type ThreadMessageRow = {
  from_address: string | null;
  subject: string | null;
  body_text: string | null;
  snippet: string | null;
  internal_date: string | null;
};

export function buildThreadText(messages: ThreadMessageRow[]): string {
  return messages
    .map((message) => {
      const date = message.internal_date
        ? new Date(message.internal_date).toISOString()
        : 'unknown date';
      const body =
        message.body_text?.trim() ||
        message.snippet?.trim() ||
        '(no body)';

      return [
        `From: ${message.from_address ?? 'unknown'}`,
        `Date: ${date}`,
        message.subject ? `Subject: ${message.subject}` : null,
        '',
        body,
      ]
        .filter((line): line is string => line !== null)
        .join('\n');
    })
    .join('\n\n---\n\n');
}
