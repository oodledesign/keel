import { JWTUserData } from '@kit/supabase/types';
import { Header } from '@kit/ui/marketing';

import { AppLogo } from '~/components/app-logo';
import { APP_LOGO_SHELL_CLASSNAME } from '~/lib/app-logo-shell';
import { marketingHeader } from '~/lib/marketing/marketing-ui';

import { SiteHeaderAccountSection } from './site-header-account-section';
import { SiteNavigation } from './site-navigation';

export function SiteHeader(props: { user?: JWTUserData | null }) {
  return (
    <Header
      className={marketingHeader}
      logo={
        <div className="flex items-center justify-start pb-1">
          <AppLogo href="/" className={APP_LOGO_SHELL_CLASSNAME} />
        </div>
      }
      navigation={<SiteNavigation />}
      actions={<SiteHeaderAccountSection user={props.user ?? null} />}
    />
  );
}
