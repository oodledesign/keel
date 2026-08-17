import { PersonalVisionChromeProvider } from '~/components/personal-vision/personal-vision-chrome-context';
import { PersonalVisionMorningPrompt } from '~/components/personal-vision/personal-vision-morning-prompt';
import { loadPersonalVisionChromeFlags } from '~/lib/personal-vision/personal-vision-chrome.loader';

/**
 * Loads Personal Vision chrome flags and wraps the workspace shell
 * (top-bar icon + morning prompt).
 */
export async function PersonalVisionChromeShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const flags = await loadPersonalVisionChromeFlags();

  return (
    <PersonalVisionChromeProvider value={flags}>
      {children}
      <PersonalVisionMorningPrompt />
    </PersonalVisionChromeProvider>
  );
}
