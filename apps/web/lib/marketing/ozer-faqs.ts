export type OzerFaqItem = {
  question: string;
  answer: string;
};

/** Full FAQ list used on /faq. */
export const OZER_FAQS: OzerFaqItem[] = [
  {
    question: 'What is Ozer?',
    answer:
      'Ozer is a Workspace OS for freelancers and small studios. Clients, projects, invoices, pipeline, activity tracking, and your plan for the day live in one place — with free personal and family workspaces connected to the same login.',
  },
  {
    question: 'Is there a free plan?',
    answer:
      'Yes. Personal home and one family workspace are free with no card and no time limit. Business Lite is also free if you mainly need apps. Paid workspaces include a 14-day trial on your first paid plan — no credit card required to start.',
  },
  {
    question: 'Do I pay per seat?',
    answer:
      'No. One workspace price covers the team. Invited members do not pay — billing stays with the workspace owner.',
  },
  {
    question: 'Can I cancel anytime?',
    answer:
      'Yes. Cancel from account settings. You keep access through the period you have already paid for.',
  },
  {
    question: 'Where do I find invoices?',
    answer:
      'In account settings under billing. Paid plans are billed in £ via Stripe.',
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'Major cards through Stripe. Bank details can also appear on client invoices you send from Ozer.',
  },
  {
    question: 'Where is my data hosted?',
    answer:
      'Ozer is built for EU data residency. Meeting audio on Mac is processed on your machine and is not kept as a permanent recording.',
  },
  {
    question: 'Do you offer non-profit pricing?',
    answer:
      'Yes — 50% off for eligible non-profits. Contact us and we will set it up.',
  },
];

function faqByQuestion(question: string): OzerFaqItem {
  const faq = OZER_FAQS.find((item) => item.question === question);
  if (!faq) {
    throw new Error(`Missing FAQ for question: ${question}`);
  }
  return faq;
}

/** Homepage teaser — product + pricing answers most visitors ask first. */
export const HOME_FAQS: OzerFaqItem[] = [
  faqByQuestion('What is Ozer?'),
  faqByQuestion('Is there a free plan?'),
  faqByQuestion('Do I pay per seat?'),
  faqByQuestion('Can I cancel anytime?'),
  faqByQuestion('Where is my data hosted?'),
  {
    question: 'Is personal and family really free forever?',
    answer:
      'Yes. Your personal hub and one family workspace stay free forever. They share one planner and today view with your studio — school runs and client calls on the same timeline.',
  },
];
