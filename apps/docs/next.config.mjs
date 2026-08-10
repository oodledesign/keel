import nextra from 'nextra';

const withNextra = nextra({
  defaultShowCopyCode: true,
  search: {
    codeblocks: false,
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    // Legacy flat docs → Business (work) workspace tree
    const legacySections = [
      'getting-started',
      'workspace',
      'clients-pipeline',
      'projects-tasks',
      'invoicing-billing',
      'activity-meetings',
      'email-assistant',
      'portals-websites',
      'security-trust',
    ];

    return legacySections.flatMap((section) => [
      {
        source: `/${section}`,
        destination: `/work/${section}`,
        permanent: true,
      },
      {
        source: `/${section}/:path*`,
        destination: `/work/${section}/:path*`,
        permanent: true,
      },
    ]);
  },
};

export default withNextra(nextConfig);
