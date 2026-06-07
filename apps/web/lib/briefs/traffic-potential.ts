const CTR_BY_POSITION: Record<number, number> = {
  1: 0.28,
  2: 0.15,
  3: 0.11,
  4: 0.08,
  5: 0.07,
  6: 0.05,
  7: 0.04,
  8: 0.03,
  9: 0.025,
  10: 0.02,
};

export function estimateTraffic(volume: number): {
  position1_3: number;
  position5: number;
} {
  return {
    position1_3: Math.round(volume * (CTR_BY_POSITION[2] ?? 0.15)),
    position5: Math.round(volume * (CTR_BY_POSITION[5] ?? 0.07)),
  };
}
