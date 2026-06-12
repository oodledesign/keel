/** Light tap feedback on supported mobile browsers (Shopify-style). */
export function triggerHapticFeedback(durationMs = 8) {
  if (typeof window === 'undefined') return;
  if (!('vibrate' in navigator)) return;

  try {
    navigator.vibrate(durationMs);
  } catch {
    // Ignore — vibration blocked or unsupported.
  }
}
