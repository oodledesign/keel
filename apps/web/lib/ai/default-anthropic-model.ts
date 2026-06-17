/** Default when ANTHROPIC_MODEL is unset (claude-sonnet-4-20250514 retired 2026-06-15). */
export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-6';

export function resolveAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;
}
