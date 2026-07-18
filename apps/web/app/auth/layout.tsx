/**
 * Soft cream canvas for auth. Sign-up / sign-in own the split card logo;
 * password-reset uses AuthFormCard (narrow) centered here.
 */
function AuthLayout({ children }: React.PropsWithChildren) {
  return (
    <div className="relative flex min-h-screen flex-col bg-[var(--ozer-cream-100)]">
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-8 md:py-12">
        {children}
      </div>
    </div>
  );
}

export default AuthLayout;
