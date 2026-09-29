export type MarketingScreenAnnotation = {
  /** Pin position as a percentage of the full screenshot. */
  x: number;
  y: number;
  label: string;
};

export type MarketingScreenData = {
  src: string;
  alt: string;
  width: number;
  height: number;
  annotations?: MarketingScreenAnnotation[];
};
