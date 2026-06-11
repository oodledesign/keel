/**
 * Strip markdown fences from model output and return the inner JSON string.
 */
export function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed);
  if (fence?.[1]) return fence[1]!.trim();
  return trimmed;
}
