import withBundleAnalyzer from '@next/bundle-analyzer';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ENABLE_REACT_COMPILER = process.env.ENABLE_REACT_COMPILER === 'true';

const INTERNAL_PACKAGES = [
  '@kit/ui',
  '@kit/auth',
  '@kit/accounts',
  '@kit/admin',
  '@kit/team-accounts',
  '@kit/shared',
  '@kit/supabase',
  '@kit/i18n',
  '@kit/keel-mcp',
  '@kit/mailers',
  '@kit/billing-gateway',
  '@kit/bunny',
  '@kit/email-templates',
  '@kit/database-webhooks',
  '@kit/cms',
  '@kit/monitoring',
  '@kit/next',
  '@kit/notifications',
];

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  /** Enables hot reloading for local packages without a build step */
  transpilePackages: INTERNAL_PACKAGES,
  images: getImagesConfig(),
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  serverExternalPackages: [],
  // needed for supporting dynamic imports for local content
  outputFileTracingIncludes: {
    '/*': ['./content/**/*'],
  },
  redirects: getRedirects,
  rewrites: getRewrites,
  turbopack: {
    resolveExtensions: ['.ts', '.tsx', '.js', '.jsx'],
    resolveAlias: getModulesAliases(),
  },
  devIndicators:
    process.env.NEXT_PUBLIC_CI === 'true'
      ? false
      : {
          position: 'bottom-right',
        },
  reactCompiler: ENABLE_REACT_COMPILER,
  experimental: {
    mdxRs: true,
    turbopackFileSystemCacheForDev: true,
    optimizePackageImports: [
      'recharts',
      'lucide-react',
      '@radix-ui/react-icons',
      '@radix-ui/react-avatar',
      '@radix-ui/react-select',
      'date-fns',
      ...INTERNAL_PACKAGES,
    ],
  },
  modularizeImports: {
    lodash: {
      transform: 'lodash/{{member}}',
    },
  },
  /** We already do linting and typechecking as separate tasks in CI */
  typescript: { ignoreBuildErrors: true },
};

export default withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})(config);

/** @returns {import('next').NextConfig['images']} */
function getImagesConfig() {
  const remotePatterns = [];

  if (SUPABASE_URL) {
    const hostname = new URL(SUPABASE_URL).hostname;

    remotePatterns.push({
      protocol: 'https',
      hostname,
    });
  }

  remotePatterns.push(
    {
      protocol: 'https',
      hostname: '**.b-cdn.net',
    },
  );

  if (IS_PRODUCTION) {
    return {
      remotePatterns,
    };
  }

  remotePatterns.push(
    ...[
      {
        protocol: 'http',
        hostname: '127.0.0.1',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  );

  return {
    remotePatterns,
  };
}

/**
 * Public URLs live under /app; existing handlers stay under app/home/** via rewrites.
 * Do not rewrite /app/family, /app/community, or /app/settings/areas — those are real routes.
 */
async function getRewrites() {
  return {
    beforeFiles: [
      {
        source: '/app/work/:account/:path*',
        destination: '/home/:account/:path*',
      },
      {
        source: '/app/work/:account',
        destination: '/home/:account',
      },
      {
        source: '/app/life/:path*',
        destination: '/home/life/:path*',
      },
      {
        source: '/app/billing/return',
        destination: '/home/billing/return',
      },
      {
        source: '/app/billing',
        destination: '/home/billing',
      },
      {
        source: '/app/billing/:path*',
        destination: '/home/billing/:path*',
      },
      {
        source: '/app/settings/accessibility',
        destination: '/home/settings/accessibility',
      },
      {
        source: '/app/settings',
        destination: '/home/settings',
      },
      {
        source: '/app/accessibility',
        destination: '/home/accessibility',
      },
      {
        source: '/app/pipeline',
        destination: '/home/pipeline',
      },
      {
        source: '/app/planner',
        destination: '/home/planner',
      },
      {
        source: '/app/people',
        destination: '/home/people',
      },
      {
        source: '/app/people/:path*',
        destination: '/home/people/:path*',
      },
      {
        source: '/app/clients',
        destination: '/home/clients',
      },
      {
        source: '/app/tasks',
        destination: '/home/tasks',
      },
      {
        source: '/app/support',
        destination: '/home/support',
      },
      {
        source: '/app/support/:path*',
        destination: '/home/support/:path*',
      },
      {
        source: '/app',
        destination: '/home',
      },
    ],
  };
}

async function getRedirects() {
  const legacyHomeRedirects = [
    {
      source: '/home/settings/accessibility',
      destination: '/app/settings/accessibility',
      permanent: false,
    },
    {
      source: '/home/settings',
      destination: '/app/settings',
      permanent: false,
    },
    {
      source: '/home/accessibility',
      destination: '/app/accessibility',
      permanent: false,
    },
    {
      source: '/home/billing/return',
      destination: '/app/billing/return',
      permanent: false,
    },
    {
      source: '/home/billing',
      destination: '/app/billing',
      permanent: false,
    },
    {
      source: '/home/pipeline',
      destination: '/app/pipeline',
      permanent: false,
    },
    {
      source: '/home/planner',
      destination: '/app/planner',
      permanent: false,
    },
    {
      source: '/home/people',
      destination: '/app/people',
      permanent: false,
    },
    {
      source: '/home/people/:path*',
      destination: '/app/people/:path*',
      permanent: false,
    },
    {
      source: '/home/clients',
      destination: '/app/clients',
      permanent: false,
    },
    {
      source: '/home/tasks',
      destination: '/app/tasks',
      permanent: false,
    },
    {
      source: '/home/support',
      destination: '/app/support',
      permanent: false,
    },
    {
      source: '/home/support/:path*',
      destination: '/app/support/:path*',
      permanent: false,
    },
    {
      source: '/home/life/:path*',
      destination: '/app/life/:path*',
      permanent: false,
    },
    {
      source: '/home/:account/:path*',
      destination: '/app/work/:account/:path*',
      permanent: false,
    },
    {
      source: '/home/:account',
      destination: '/app/work/:account',
      permanent: false,
    },
    {
      source: '/home',
      destination: '/app',
      permanent: false,
    },
  ];

  // Legacy marketing pages still disabled; segment landings, pricing, contact, FAQ, and legal stay public.
  const marketingRedirects = [
    '/blog',
    '/blog/:path*',
    '/docs',
    '/docs/:path*',
    '/changelog',
    '/changelog/:path*',
    '/about',
    '/careers',
  ].map((source) => ({
    source,
    destination: '/',
    permanent: false,
  }));

  return [
    ...legacyHomeRedirects,
    {
      source: '/server-sitemap.xml',
      destination: '/sitemap.xml',
      permanent: true,
    },
    ...marketingRedirects,
  ];
}

/**
 * @description Aliases modules based on the environment variables
 * This will speed up the development server by not loading the modules that are not needed
 * @returns {Record<string, string>}
 */
function getModulesAliases() {
  if (process.env.NODE_ENV !== 'development') {
    return {};
  }

  const monitoringProvider = process.env.NEXT_PUBLIC_MONITORING_PROVIDER;
  const billingProvider = process.env.NEXT_PUBLIC_BILLING_PROVIDER;
  const mailerProvider = process.env.MAILER_PROVIDER;
  const captchaProvider = process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY;

  // exclude the modules that are not needed
  const excludeSentry = monitoringProvider !== 'sentry';
  const excludeStripe = billingProvider !== 'stripe';
  const excludeNodemailer = mailerProvider !== 'nodemailer';
  const excludeTurnstile = !captchaProvider;

  /** @type {Record<string, string>} */
  const aliases = {};

  // the path to the noop module
  const noopPath = '~/lib/dev-mock-modules';

  if (excludeSentry) {
    aliases['@sentry/nextjs'] = noopPath;
  }

  if (excludeStripe) {
    aliases['stripe'] = noopPath;
    aliases['@stripe/stripe-js'] = noopPath;
  }

  if (excludeNodemailer) {
    aliases['nodemailer'] = noopPath;
  }

  if (excludeTurnstile) {
    aliases['@marsidev/react-turnstile'] = noopPath;
  }

  return aliases;
}
