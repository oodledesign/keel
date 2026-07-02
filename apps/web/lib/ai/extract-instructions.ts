const MAX_EXTRACT_INSTRUCTIONS_LENGTH = 2_000;

/** Trim and cap user-provided extraction guidance for AI prompts. */
export function normalizeExtractInstructions(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_EXTRACT_INSTRUCTIONS_LENGTH);
}

/** Prompt block appended when the user supplied extraction guidance. */
export function formatExtractInstructionsBlock(
  instructions: string | null | undefined,
): string {
  const normalized = normalizeExtractInstructions(instructions);
  if (!normalized) return '';

  return `\nUser instructions (follow these when deciding what to extract, how to group items, and how to word tasks):\n${normalized}\n`;
}

export { MAX_EXTRACT_INSTRUCTIONS_LENGTH };
