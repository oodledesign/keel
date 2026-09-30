/** Newest update on an instruction, for the collapsed ladder row. */
export type WipLatestUpdate = {
  /** ISO timestamp of the update. */
  at: string;
  /** Plain text of the update, import markers removed. */
  text: string;
};

/** Notes imported from a spreadsheet carry a leading `[import_key:…]` line. */
export function cleanWipUpdateText(content: string | null | undefined) {
  return (content ?? '')
    .replace(/^\[import_key:[^\]]+\]\n?/, '')
    .trim()
    .replace(/\s+/g, ' ');
}
