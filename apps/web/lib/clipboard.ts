/**
 * Copy text to the clipboard, tolerating transiently unfocused documents.
 *
 * `navigator.clipboard.writeText` throws "Document is not focused" when the
 * call happens outside a user gesture — e.g. after an awaited fetch, or while
 * a closing dropdown menu is mid focus-transition. This helper refocuses the
 * window, retries, and finally falls back to a hidden textarea +
 * `document.execCommand('copy')`, which does not require document focus.
 */
export async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('Clipboard is only available in the browser');
  }

  try {
    window.focus();
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Fall through to the legacy path below.
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);

  try {
    textarea.select();
    const copied = document.execCommand('copy');
    if (!copied) {
      throw new Error('Copying to the clipboard failed');
    }
  } finally {
    document.body.removeChild(textarea);
  }
}
