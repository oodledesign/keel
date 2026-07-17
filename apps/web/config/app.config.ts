import { z } from 'zod';

const production = process.env.NODE_ENV === 'production';

const AppConfigSchema = z
  .object({
    name: z
      .string({
        description: `This is the name of your SaaS. Ex. "Ozer"`,
        required_error: `Please provide the variable NEXT_PUBLIC_PRODUCT_NAME`,
      })
      .min(1),
    title: z
      .string({
        description: `This is the default title tag of your SaaS.`,
        required_error: `Please provide the variable NEXT_PUBLIC_SITE_TITLE`,
      })
      .min(1),
    description: z.string({
      description: `This is the default description of your SaaS.`,
      required_error: `Please provide the variable NEXT_PUBLIC_SITE_DESCRIPTION`,
    }),
    url: z
      .string({
        required_error: `Please provide the variable NEXT_PUBLIC_SITE_URL`,
      })
      .url({
        message: `You are deploying a production build but have entered a NEXT_PUBLIC_SITE_URL variable using http instead of https. It is very likely that you have set the incorrect URL. The build will now fail to prevent you from from deploying a faulty configuration. Please provide the variable NEXT_PUBLIC_SITE_URL with a valid URL, such as: 'https://example.com'`,
      }),
    locale: z
      .string({
        description: `This is the default locale of your SaaS.`,
        required_error: `Please provide the variable NEXT_PUBLIC_DEFAULT_LOCALE`,
      })
      .default('en'),
    theme: z.enum(['light', 'dark', 'system']),
    production: z.boolean(),
    themeColor: z.string(),
    themeColorDark: z.string(),
  })
  .refine(
    (schema) => {
      const isCI = process.env.NEXT_PUBLIC_CI;

      if (isCI ?? !schema.production) {
        return true;
      }

      return !schema.url.startsWith('http:');
    },
    {
      message: `Please provide a valid HTTPS URL. Set the variable NEXT_PUBLIC_SITE_URL with a valid URL, such as: 'https://example.com'`,
      path: ['url'],
    },
  )
  .refine(
    (schema) => {
      return schema.themeColor !== schema.themeColorDark;
    },
    {
      message: `Please provide different theme colors for light and dark themes.`,
      path: ['themeColor'],
    },
  );

const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Ozer';

const appConfig = AppConfigSchema.parse({
  name: productName,
  title: process.env.NEXT_PUBLIC_SITE_TITLE ?? productName,
  description:
    process.env.NEXT_PUBLIC_SITE_DESCRIPTION ??
    'Ozer is the workspace OS for freelancers and small agencies — personal, business, property, and community in one account. One home for tasks, planner, and every workspace.',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  locale: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
  theme: (process.env.NEXT_PUBLIC_DEFAULT_THEME_MODE ?? 'dark') as
    | 'light'
    | 'dark'
    | 'system',
  themeColor: process.env.NEXT_PUBLIC_THEME_COLOR ?? '#FBF6EC',
  themeColorDark:
    process.env.NEXT_PUBLIC_THEME_COLOR_DARK ?? 'var(--ozer-plum-900)',
  production,
});

export default appConfig;
