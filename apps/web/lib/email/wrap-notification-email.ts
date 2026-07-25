/**
 * Shared transactional email shell used by trial reminders, platform support,
 * and workspace client-support notifications.
 */
export function wrapNotificationEmail(body: string) {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">${body}</body></html>`;
}

export function escapeNotificationHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
