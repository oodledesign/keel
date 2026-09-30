import { wipStageColour } from '~/lib/commercial/wip-stage-colours';

/** Small stage-coloured dot, used beside stage names in dropdowns. */
export function WipStageDot({ stageKey }: { stageKey: string }) {
  return (
    <span
      aria-hidden
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: wipStageColour(stageKey).bar }}
    />
  );
}
