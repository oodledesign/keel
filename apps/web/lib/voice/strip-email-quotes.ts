/** Lightweight cleanup before storing sent-email voice samples. */
export function stripEmailQuotesAndSignature(body: string): string {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const kept: string[] = [];

  for (const line of lines) {
    if (/^>/.test(line)) continue;
    if (/^On .+ wrote:$/i.test(line.trim())) break;
    if (/^-{2,}\s*$/.test(line.trim())) break;
    if (/^_{2,}\s*$/.test(line.trim())) break;
    if (/^sent from my /i.test(line.trim())) break;
    kept.push(line);
  }

  return kept.join('\n').trim();
}
