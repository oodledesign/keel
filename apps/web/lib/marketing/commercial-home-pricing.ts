import { formatGbp } from '~/lib/billing/billing-config-prices';
import {
  COMMERCIAL_GRADUATED_TIERS,
  COMMERCIAL_ILLUSTRATIVE_TIERS,
  estimateMonthlyBreakdownGbp,
  formatGraduatedWorkedExample,
  freeSupportSeats,
} from '~/lib/billing/commercial-graduated-pricing';

export type CommercialHomePricing = {
  fromLabel: string;
  bands: { label: string; unitLabel: string }[];
  example: {
    seats: number;
    totalLabel: string;
    workedLabel: string;
    supportSeats: number;
  };
};

export function getCommercialHomePricing(): CommercialHomePricing {
  const [firstTier] = COMMERCIAL_GRADUATED_TIERS;
  const exampleSeats =
    COMMERCIAL_ILLUSTRATIVE_TIERS.find((tier) => tier.highlighted)
      ?.billableSeats ?? 4;

  return {
    fromLabel: formatGbp(firstTier.unitGbp),
    bands: COMMERCIAL_GRADUATED_TIERS.map((tier) => ({
      label: tier.bandLabel,
      unitLabel: formatGbp(tier.unitGbp),
    })),
    example: {
      seats: exampleSeats,
      totalLabel: formatGbp(estimateMonthlyBreakdownGbp(exampleSeats).totalGbp),
      workedLabel: formatGraduatedWorkedExample(
        exampleSeats,
        formatGbp,
      ).replace(/^e\.g\.\s+/, ''),
      supportSeats: freeSupportSeats(exampleSeats),
    },
  };
}
