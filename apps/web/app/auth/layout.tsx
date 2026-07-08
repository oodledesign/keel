import { AppLogo } from '~/components/app-logo';
import { cn } from '@kit/ui/utils';

/**
 * Auth pages share a marketing grain canvas + logo.
 * Each page owns its own width/card so sign-up can use a two-column layout
 * without constraining sign-in / password reset.
 */
function AuthLayout({ children }: React.PropsWithChildren) {
  return (
    <div className="marketing-grain relative flex min-h-screen flex-col">
      <div className="relative z-10 flex justify-center px-4 pt-8 pb-4 md:pt-10">
        <AppLogo className="h-8 w-auto" />
      </div>
      <div
        className={cn(
          'relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-12',
        )}
      >
        {children}
      </div>
    </div>
  );
}

export default AuthLayout;
