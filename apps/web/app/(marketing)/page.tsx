import Link from 'next/link';

import {
  Accessibility,
  Brain,
  ListChecks,
  BarChart3,
  Users,
  FileText,
  CheckCircle2,
  CreditCard,
  Building2,
  Clock,
  Calendar,
  Receipt,
  TrendingUp,
  Calculator,
  MessageCircle,
} from 'lucide-react';

import {
  LandingHero,
  BuiltForGrid,
  ActionPreview,
  FeaturesSection,
  CommandCenter,
  SocialProof,
  FAQSection,
  FinalCta,
} from '@kit/ui/marketing';
import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';
import { withI18n } from '~/lib/i18n/with-i18n';

export const metadata = {
  title: 'Keel – Trade management made simple and accessible',
  description:
    'Keel brings clarity to your business operations with tools designed for tradespeople who value simplicity, structure, and peace of mind.',
};

function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Hero Section */}
      <LandingHero
        headline="Trade management made simple and accessible"
        highlightedText="simple and accessible"
        subtitle="Keel brings clarity to your business operations with tools designed for tradespeople who value simplicity, structure, and peace of mind."
        primaryCta={{
          label: 'Get Started Free',
          href: pathsConfig.auth.signUp,
        }}
        secondaryCta={{
          label: 'Watch Demo',
          href: '#demo',
        }}
        primaryCtaShowArrow={false}
        disclaimerItems={[
          'No credit card required',
          '14-day free trial',
          'Cancel anytime',
        ]}
      />

      {/* Built for clarity and ease */}
      <div id="built-for">
        <BuiltForGrid
          heading="Built for clarity and ease"
          subheading="Every feature in Keel is designed to reduce complexity and help you focus on what matters most—your work."
        cards={[
          {
            icon: <Accessibility className="h-8 w-8 text-[#57C87F]" />,
            title: 'Accessibility First',
            description:
              'Designed with accessibility standards in mind. Clear contrast, readable fonts, and intuitive navigation ensure everyone can use Keel with confidence.',
          },
          {
            icon: <Brain className="h-8 w-8 text-[#57C87F]" />,
            title: 'Reduced Cognitive Load',
            description:
              'No overwhelming dashboards or hidden menus. We present only what you need, when you need it, so you can make decisions faster.',
          },
          {
            icon: <ListChecks className="h-8 w-8 text-[#57C87F]" />,
            title: 'Clear Workflows',
            description:
              'From quoting to invoicing, every step is laid out clearly. No guesswork, no confusion—just straightforward tools for tradespeople.',
          },
        ]}
        />
      </div>

      {/* See Keel in action (video / demo) */}
      <div id="demo">
        <ActionPreview
          heading="See Keel in action"
          subheading="Watch how Keel simplifies your daily operations, from job scheduling to client communication, all in one calm and organised platform."
          overlayFeatures={[
            {
              icon: <Clock className="h-6 w-6" />,
              title: 'Quick Setup',
              subtitle: 'Get started in under 5 minutes',
            },
            {
              icon: <Users className="h-6 w-6" />,
              title: 'Team Collaboration',
              subtitle: 'Work seamlessly with your crew',
            },
          ]}
        />
      </div>

      {/* Everything you need to run your trade */}
      <FeaturesSection
        heading="Everything you need to run your trade"
        description="From start to finish, Keel manages everything from scheduling to invoicing, providing tools that align perfectly with your business needs."
        ctaLabel="Get Started Free"
        ctaHref={pathsConfig.auth.signUp}
        features={[
          {
            icon: <Users className="h-6 w-6" />,
            iconColor: '#D97B29',
            title: 'Client Management',
            description:
              'Keep all client information, job history, and communication in one place. Build stronger relationships with better organisation.',
            features: [
              'Centralized client database',
              'Job history and notes',
              'Communication timeline',
            ],
          },
          {
            icon: <Calendar className="h-6 w-6" />,
            iconColor: '#8D6BA5',
            title: 'Smart Scheduling',
            description:
              'Organise jobs, assign team members, and view your calendar at a glance. Drag-and-drop functionality makes rescheduling effortless.',
            features: [
              'Drag-and-drop calendar interface',
              'Automated reminders and notifications',
              'Team availability tracking',
            ],
          },
          {
            icon: <Receipt className="h-6 w-6" />,
            iconColor: '#187A99',
            title: 'Professional Invoicing',
            description:
              'Create branded invoices in seconds. Track payments, send reminders, and keep your cash flow healthy without the paperwork.',
            features: [
              'Customizable invoice templates',
              'Automatic payment reminders',
              'Payment status tracking',
            ],
          },
          {
            icon: <TrendingUp className="h-6 w-6" />,
            iconColor: '#57C87F',
            title: 'Business Insights',
            description:
              'Understand your business performance with clear reports. Track revenue, identify trends, and make informed decisions.',
            features: [
              'Revenue and profit tracking',
              'Visual reports and charts',
              'Export data for accounting',
            ],
          },
        ]}
      />

      {/* Pricing Section */}
      <div id="pricing" className="bg-white py-16 dark:bg-gray-900 lg:py-24">
        <div className="container mx-auto">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white lg:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-gray-600 dark:text-gray-400">
              Choose the plan that fits your business. All plans include our core features with no hidden fees or surprises.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3 lg:max-w-5xl lg:mx-auto">
            {/* Basic */}
            <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Basic</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Perfect for solo tradespeople</p>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">£24 <span className="text-base font-normal text-gray-600 dark:text-gray-400">/ month</span></p>
              <ul className="mt-6 flex-1 space-y-3 text-sm text-gray-600 dark:text-gray-400">
                {['Unlimited Jobs', 'Up to 4 new clients per month', 'All accessibility features', 'Professional invoicing', 'Basic reporting', 'Email support'].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#57C87F]" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-6 w-full rounded-lg bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200">
                <Link href={pathsConfig.auth.signUp}>Get Started</Link>
              </Button>
            </div>
            {/* Professional */}
            <div className="relative flex flex-col rounded-xl border-2 border-[#57C87F] bg-white p-6 shadow-sm dark:bg-gray-900">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#57C87F] px-3 py-0.5 text-xs font-medium text-white">POPULAR</span>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Professional</h3>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">£40 <span className="text-base font-normal text-gray-600 dark:text-gray-400">/ month</span></p>
              <ul className="mt-6 flex-1 space-y-3 text-sm text-gray-600 dark:text-gray-400">
                {['Unlimited jobs', 'Unlimited clients', 'Advanced invoicing & quotes', 'Team collaboration (up to 5)', 'Advanced reporting', 'Priority support'].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#57C87F]" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-6 w-full rounded-lg bg-[#57C87F] text-white hover:bg-[#4ab86f]">
                <Link href={pathsConfig.auth.signUp}>Get Started</Link>
              </Button>
            </div>
            {/* Enterprise */}
            <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Enterprise</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">For established trade companies</p>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">£70 <span className="text-base font-normal text-gray-600 dark:text-gray-400">/ month</span></p>
              <ul className="mt-6 flex-1 space-y-3 text-sm text-gray-600 dark:text-gray-400">
                {['Everything in Professional', 'Unlimited team members', 'All Interior designer tools', 'Custom branding', 'API access', 'Dedicated account manager', '24/7 phone support'].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#57C87F]" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-6 w-full rounded-lg bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200">
                <Link href={pathsConfig.auth.signUp}>Get Started</Link>
              </Button>
            </div>
          </div>

          <p className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
            All plans include a 30-day money-back guarantee.
          </p>
        </div>
      </div>

      {/* Your command center */}
      <CommandCenter
        heading="Your command center"
        subheading="The Keel dashboard adapts to your workflow. Switch between views, customize layouts, and access the information you need instantly."
        dashboardImage="/images/dashboard.webp"
        dashboardAlt="Keel dashboard showing trade management interface"
        dashboardTabs={['Projects view', 'Team view', 'Invoices View']}
      />

      {/* Testimonials */}
      <div id="testimonials">
        <SocialProof
          heading="Trusted by tradespeople nationwide"
          subheading="See how Keel is helping trade professionals save time, reduce stress, and grow their businesses."
        testimonials={[
          {
            quote:
              'Keel has revolutionized how we manage our trades. The automation features have saved us countless hours.',
            author: {
              name: 'Sarah K.',
              role: 'Head of Operations, Global Traders Inc.',
              company: '',
            },
          },
          {
            quote:
              'The client portal is a game-changer. Our clients love the transparency and ease of access to their information.',
            author: {
              name: 'Michael P.',
              role: 'Senior Trader, Apex Investments',
              company: '',
            },
          },
          {
            quote:
              'Support is exceptional! Whenever we have a question, the Keel team is quick to respond and incredibly helpful.',
            author: {
              name: 'Emily R.',
              role: 'Founder & CEO, Insight Trade Solutions',
              company: '',
            },
          },
        ]}
        />
      </div>

      {/* Works with the tools you already use */}
      <div id="integrations" className="bg-gray-50 py-16 dark:bg-gray-800 lg:py-24">
        <div className="container mx-auto">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white lg:text-4xl">
              Works with the tools you already use
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-gray-600 dark:text-gray-400">
              Keel integrates seamlessly with popular accounting, payment, and communication platforms to keep your workflow smooth.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: <Calculator className="h-8 w-8 text-[#57C87F]" />,
                title: 'Accounting Software',
                description:
                  'Connect with Xero, Sage, QuickBooks, and FreeAgent to sync your financial data automatically.',
              },
              {
                icon: <CreditCard className="h-8 w-8 text-[#187A99]" />,
                title: 'Payment Platforms',
                description:
                  'Accept payments via Stripe, PayPal, and GoCardless directly through your invoices.',
              },
              {
                icon: <Calendar className="h-8 w-8 text-[#8D6BA5]" />,
                title: 'Calendar Sync',
                description:
                  'Sync with Google Calendar and Outlook to keep your schedule unified across all devices.',
              },
              {
                icon: <MessageCircle className="h-8 w-8 text-[#E07C34]" />,
                title: 'Communication Tools',
                description:
                  'Send SMS and email updates to clients directly from Keel with automated notifications.',
              },
            ].map((integration, index) => (
              <div
                key={index}
                className="flex flex-col items-center rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                  {integration.icon}
                </div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                  {integration.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {integration.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <FAQSection
        heading="Frequently asked questions"
        subheading="Have questions? We have answers. If you can't find what you're looking for, our support team is here to help."
        faqs={[
          {
            question: 'How long does it take to set up Keel?',
            answer:
              'Most tradespeople are up and running in under 5 minutes. Sign up, add your business details, and you can start creating jobs and adding clients straight away. If you need to import existing data, our support team can help.',
          },
          {
            question: 'Can I import my existing client data?',
            answer:
              'Yes. You can import clients and jobs via CSV, or we can help you migrate from another system. Contact our support team and we’ll guide you through the process so nothing gets left behind.',
          },
          {
            question: 'Is my data secure?',
            answer:
              'Absolutely. Your data is encrypted, stored on secure servers, and we follow industry best practices. We’re committed to keeping your and your clients’ information safe.',
          },
          {
            question: 'Can I cancel my subscription at any time?',
            answer:
              'Yes. You can cancel anytime from your account settings. There are no long-term contracts. If you cancel, you’ll keep access until the end of your billing period.',
          },
          {
            question: 'Do you offer training or support?',
            answer:
              'Yes. All plans include email support, and we have guides and videos to get you started. Professional and Enterprise plans include priority support; Enterprise also includes a dedicated account manager.',
          },
        ]}
        viewAllHref="/faq"
        viewAllLabel="View all questions"
      />

      {/* Final CTA */}
      <FinalCta
        heading="Ready to simplify your trade business?"
        subheading="Join other neurodiverse trades people who trust Keel to manage their business with clarity and confidence."
        primaryCta={{
          label: 'Start Your Free Trial',
          href: pathsConfig.auth.signUp,
        }}
        secondaryCta={{
          label: 'Talk to Client Support',
          href: '/contact',
        }}
        primaryCtaShowArrow={false}
      />
    </div>
  );
}

export default withI18n(Home);
