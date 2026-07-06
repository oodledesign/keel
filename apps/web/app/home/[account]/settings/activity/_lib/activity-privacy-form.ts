import type {
  ActivityPrivacyFormValues,
  ActivityPrivacySettings,
} from '~/home/[account]/settings/activity/_lib/activity-privacy-settings.schema';

export function parseLineList(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function formatLineList(values: string[]): string {
  return values.join('\n');
}

export function buildActivityPrivacyFormDefaults(
  settings: ActivityPrivacySettings | null,
): ActivityPrivacyFormValues {
  return {
    tracking_enabled: settings?.tracking_enabled ?? false,
    capture_full_urls: settings?.capture_full_urls ?? false,
    idle_threshold_seconds: settings?.idle_threshold_seconds ?? 120,
    excluded_apps_text: formatLineList(settings?.excluded_apps ?? []),
    excluded_domains_text: formatLineList(settings?.excluded_domains ?? []),
  };
}

export function formValuesToSettings(
  values: ActivityPrivacyFormValues,
): Pick<
  ActivityPrivacySettings,
  | 'tracking_enabled'
  | 'capture_full_urls'
  | 'idle_threshold_seconds'
  | 'excluded_apps'
  | 'excluded_domains'
> {
  return {
    tracking_enabled: values.tracking_enabled,
    capture_full_urls: values.capture_full_urls,
    idle_threshold_seconds: values.idle_threshold_seconds,
    excluded_apps: parseLineList(values.excluded_apps_text),
    excluded_domains: parseLineList(values.excluded_domains_text),
  };
}
