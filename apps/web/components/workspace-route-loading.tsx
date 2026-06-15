import { GlobalLoader } from '@kit/ui/global-loader';

/** Lightweight route transition — top bar only, shell stays visible. */
export default function WorkspaceRouteLoading() {
  return <GlobalLoader displaySpinner={false} fullPage={false} />;
}
