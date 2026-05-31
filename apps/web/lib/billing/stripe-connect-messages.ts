/** Client-safe Stripe Connect user messages (no server-only imports). */

export function stripeConnectErrorMessage(code: string): string {
  switch (code) {
    case 'access_denied':
      return 'Stripe Connect was cancelled. You can try again from Settings → Business details.';
    case 'missing_params':
      return 'Stripe did not return the information needed to finish connecting. Try again from Settings → Business details.';
    case 'invalid_state':
      return 'This Connect session expired or was invalid. Start again from Settings → Business details.';
    case 'stripe_not_configured':
      return 'Stripe is not configured on this environment (missing secret key).';
    case 'connect_not_configured':
      return 'Stripe Connect is not configured (missing STRIPE_CONNECT_CLIENT_ID).';
    case 'save_failed':
      return 'Stripe connected but we could not save it. Contact support if this persists.';
    case 'mode_mismatch':
      return 'Stripe secret key mode (test vs live) does not match your Connect application. Use test keys with a test Connect client ID, or live with live.';
    case 'oauth_failed':
      return 'Stripe could not complete Connect. Confirm test/live keys and Connect client ID are from the same Stripe account mode.';
    default:
      return `Stripe Connect failed (${code}). Check that test/live keys and Connect settings match.`;
  }
}
