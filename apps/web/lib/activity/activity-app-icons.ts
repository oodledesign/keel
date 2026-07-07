import type { ActivityBlockListRow } from '~/lib/activity/activity-history';

export type ActivityAppIconInfo = {
  src: string | null;
  fallback: string;
  background: string;
};

const BUNDLE_HOSTS: Array<{ match: string; host: string; background: string }> = [
  { match: 'com.google.chrome', host: 'google.com', background: '#4285F4' },
  { match: 'com.brave.browser', host: 'brave.com', background: '#FB542B' },
  { match: 'com.microsoft.edgemac', host: 'microsoft.com', background: '#0078D4' },
  { match: 'org.mozilla.firefox', host: 'mozilla.org', background: '#FF7139' },
  { match: 'com.apple.safari', host: 'apple.com', background: '#0A84FF' },
  { match: 'com.todesktop.cursor', host: 'cursor.com', background: '#6B4FBB' },
  { match: 'com.microsoft.vscode', host: 'code.visualstudio.com', background: '#007ACC' },
  { match: 'com.figma.desktop', host: 'figma.com', background: '#A259FF' },
  { match: 'com.adobe.illustrator', host: 'adobe.com', background: '#FF9A00' },
  { match: 'com.adobe.photoshop', host: 'adobe.com', background: '#31A8FF' },
  { match: 'com.microsoft.word', host: 'microsoft.com', background: '#2B579A' },
  { match: 'com.microsoft.excel', host: 'microsoft.com', background: '#217346' },
  { match: 'com.microsoft.powerpoint', host: 'microsoft.com', background: '#D24726' },
  { match: 'com.microsoft.teams', host: 'teams.microsoft.com', background: '#6264A7' },
  { match: 'com.microsoft.outlook', host: 'outlook.com', background: '#0078D4' },
  { match: 'com.apple.mail', host: 'apple.com', background: '#0A84FF' },
  { match: 'com.readdle.sparkdesktop', host: 'sparkmailapp.com', background: '#FF4F00' },
  { match: 'com.tinyspeck.slackmacgap', host: 'slack.com', background: '#4A154B' },
  { match: 'com.hnc.discord', host: 'discord.com', background: '#5865F2' },
  { match: 'com.notion.id', host: 'notion.so', background: '#000000' },
  { match: 'com.linear', host: 'linear.app', background: '#5E6AD2' },
  { match: 'com.zoom.xos', host: 'zoom.us', background: '#2D8CFF' },
  { match: 'us.zoom.xos', host: 'zoom.us', background: '#2D8CFF' },
];

const APP_NAME_HOSTS: Array<{ match: string; host: string; background: string }> = [
  { match: 'chrome', host: 'google.com', background: '#4285F4' },
  { match: 'cursor', host: 'cursor.com', background: '#6B4FBB' },
  { match: 'figma', host: 'figma.com', background: '#A259FF' },
  { match: 'slack', host: 'slack.com', background: '#4A154B' },
  { match: 'discord', host: 'discord.com', background: '#5865F2' },
  { match: 'notion', host: 'notion.so', background: '#000000' },
  { match: 'linear', host: 'linear.app', background: '#5E6AD2' },
  { match: 'zoom', host: 'zoom.us', background: '#2D8CFF' },
  { match: 'outlook', host: 'outlook.com', background: '#0078D4' },
  { match: 'mail', host: 'apple.com', background: '#0A84FF' },
  { match: 'safari', host: 'apple.com', background: '#0A84FF' },
  { match: 'visual studio code', host: 'code.visualstudio.com', background: '#007ACC' },
];

function faviconUrl(host: string) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`;
}

export function faviconUrlForDomain(domain: string) {
  return faviconUrl(domain.trim());
}

function appInitial(appName: string) {
  const trimmed = appName.trim();
  if (!trimmed) {
    return '?';
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]![0] ?? ''}${words[1]![0] ?? ''}`.toUpperCase();
  }

  return trimmed.slice(0, 2).toUpperCase();
}

function hashBackground(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = value.charCodeAt(index) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 42% 38%)`;
}

export function resolveActivityAppIcon(
  block: Pick<ActivityBlockListRow, 'appName' | 'bundleId' | 'domain'>,
): ActivityAppIconInfo {
  const bundle = block.bundleId.trim().toLowerCase();
  const appName = block.appName.trim().toLowerCase();
  const fallback = appInitial(block.appName);

  for (const entry of BUNDLE_HOSTS) {
    if (bundle.includes(entry.match)) {
      return {
        src: faviconUrl(entry.host),
        fallback,
        background: entry.background,
      };
    }
  }

  for (const entry of APP_NAME_HOSTS) {
    if (appName.includes(entry.match)) {
      return {
        src: faviconUrl(entry.host),
        fallback,
        background: entry.background,
      };
    }
  }

  const domain = block.domain?.trim();
  if (domain) {
    return {
      src: faviconUrl(domain),
      fallback,
      background: hashBackground(domain),
    };
  }

  return {
    src: null,
    fallback,
    background: hashBackground(block.appName || bundle || 'app'),
  };
}
