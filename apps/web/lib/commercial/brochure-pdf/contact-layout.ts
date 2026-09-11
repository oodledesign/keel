/**
 * Contact-page shopfront frame: sits under the branch address in the
 * office column. Never right-aligned beside the agents list.
 */
export function brochureContactShopfrontBox(input: {
  landscape: boolean;
  pageWidth: number;
  margin: number;
  branchCardWidth: number;
  afterAddressY: number;
}): { x: number; y: number; width: number; height: number } {
  const width = input.landscape
    ? Math.min(input.branchCardWidth, 280)
    : Math.min(260, input.pageWidth - input.margin * 2);
  const desiredHeight = input.landscape ? 140 : 160;
  const height = Math.min(
    desiredHeight,
    Math.max(72, input.afterAddressY - input.margin - 12),
  );

  return {
    x: input.margin,
    y: input.afterAddressY - height - 12,
    width,
    height,
  };
}
