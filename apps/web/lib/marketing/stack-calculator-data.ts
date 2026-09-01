import { estimateMonthlyGbp } from '~/lib/billing/business-graduated-pricing';
import { estimateStarterMonthlyGbp } from '~/lib/billing/business-starter-pricing';

export type StackTool = {
  id: string;
  category:
    | 'PM'
    | 'Invoicing'
    | 'CRM'
    | 'Scheduling'
    | 'Meeting notes'
    | 'Time tracking'
    | 'Email'
    | 'Client portal';
  name: string;
  defaultMonthlyGbp: number;
  perSeat: boolean;
  defaultSeats: number;
};

/** Sensible UK defaults for common tools — editable in the calculator. */
export const STACK_TOOLS: StackTool[] = [
  {
    id: 'pm',
    category: 'PM',
    name: 'Project management (e.g. Asana / ClickUp)',
    defaultMonthlyGbp: 12,
    perSeat: true,
    defaultSeats: 4,
  },
  {
    id: 'crm',
    category: 'CRM',
    name: 'CRM / pipeline',
    defaultMonthlyGbp: 15,
    perSeat: true,
    defaultSeats: 4,
  },
  {
    id: 'invoicing',
    category: 'Invoicing',
    name: 'Invoicing software',
    defaultMonthlyGbp: 20,
    perSeat: false,
    defaultSeats: 1,
  },
  {
    id: 'scheduling',
    category: 'Scheduling',
    name: 'Scheduling / shared tasks',
    defaultMonthlyGbp: 12,
    perSeat: false,
    defaultSeats: 1,
  },
  {
    id: 'meetings',
    category: 'Meeting notes',
    name: 'AI meeting notes',
    defaultMonthlyGbp: 20,
    perSeat: false,
    defaultSeats: 1,
  },
  {
    id: 'time-tracking',
    category: 'Time tracking',
    name: 'Automatic time tracking',
    defaultMonthlyGbp: 12,
    perSeat: true,
    defaultSeats: 4,
  },
  {
    id: 'email',
    category: 'Email',
    name: 'Email productivity add-on',
    defaultMonthlyGbp: 10,
    perSeat: true,
    defaultSeats: 4,
  },
  {
    id: 'portal',
    category: 'Client portal',
    name: 'Client portal / client-flow',
    defaultMonthlyGbp: 29,
    perSeat: false,
    defaultSeats: 1,
  },
];

export type StackOzerPlan = 'starter' | 'pro';

export function ozerMonthlyForPlan(
  plan: StackOzerPlan,
  seats: number,
): number {
  return plan === 'starter'
    ? estimateStarterMonthlyGbp(seats)
    : estimateMonthlyGbp(seats);
}

export function ozerAnnualForPlan(plan: StackOzerPlan, seats: number): number {
  return ozerMonthlyForPlan(plan, seats) * 10;
}

/** 4-seat Pro annual (10× monthly) for stack comparisons. */
export function ozerAnnualFromBilling(): number {
  return ozerAnnualForPlan('pro', 4);
}

export function ozerMonthlyFromBilling(): number {
  return ozerMonthlyForPlan('pro', 4);
}

export const CALCULATOR_FAQS = [
  {
    question:
      'How much does business software cost for a small agency in the UK?',
    answer:
      'It depends on seats and fees. Many studios pay separate subscriptions for PM, CRM, invoicing, portals, and meeting tools. This calculator totals your stack in pounds per year so you can compare it to Ozer Business on graduated seats.',
  },
  {
    question: 'Are the default prices accurate?',
    answer:
      'Defaults are sensible UK starting points, not quotes. Edit every field to match your invoices.',
  },
  {
    question: 'Does the card-fee line use Ozer fees?',
    answer:
      'No. The optional card-fee line models tools that charge about 2.9% + £0.20 per card payment (US-style fee schedules often quote 2.9% + 25¢). Ozer’s subscription does not add a platform cut on top of Stripe.',
  },
  {
    question: 'Is Ozer’s comparison price per seat?',
    answer:
      'Starter and Pro both use graduated seats. The default comparison is 4-seat Pro (£29 + 3 × £22 = £95/mo). Change seats or switch to Starter (£14 + extra seats at £9) in the calculator.',
  },
];
