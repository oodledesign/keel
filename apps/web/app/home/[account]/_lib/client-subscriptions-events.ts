export const CLIENT_SUBSCRIPTIONS_CHANGED_EVENT =
  'ozer:client-subscriptions-changed';

export function notifyClientSubscriptionsChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CLIENT_SUBSCRIPTIONS_CHANGED_EVENT));
}
