import { z } from 'zod';

export const LAUNCH_INTEREST_SOURCES = [
  'coming-soon',
  'home-hero',
  'home-final',
] as const;

export type LaunchInterestSource = (typeof LAUNCH_INTEREST_SOURCES)[number];

export const WaitlistEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter your email address.')
    .email('Enter a valid email address.')
    .max(320),
});

export type WaitlistEmailValues = z.infer<typeof WaitlistEmailSchema>;

export function parseLaunchInterestSource(
  input: unknown,
): LaunchInterestSource {
  return typeof input === 'string' &&
    LAUNCH_INTEREST_SOURCES.includes(input as LaunchInterestSource)
    ? (input as LaunchInterestSource)
    : 'coming-soon';
}
