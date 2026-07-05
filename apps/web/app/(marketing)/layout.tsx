import { AuthRedirectFromTokens } from '~/components/auth-redirect-from-tokens';

import { SiteFooter } from '~/(marketing)/_components/site-footer';
import { SiteHeader } from '~/(marketing)/_components/site-header';
import { withI18n } from '~/lib/i18n/with-i18n';
import { getOptionalUserInServerComponent } from '~/lib/server/get-optional-user-in-server-component';
import { JsonLd } from '~/lib/seo/json-ld';
import { organizationJsonLd } from '~/lib/seo/schema';

async function SiteLayout(props: React.PropsWithChildren) {
  const user = await getOptionalUserInServerComponent();

  return (
    <div className="marketing-grain min-h-[100vh]">
      <div className="flex min-h-[100vh] flex-col">
        <JsonLd data={organizationJsonLd()} />
        <AuthRedirectFromTokens />
        <SiteHeader user={user} />

        {props.children}

        <SiteFooter />
      </div>
    </div>
  );
}

export default withI18n(SiteLayout);
