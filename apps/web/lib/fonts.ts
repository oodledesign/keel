/**
 * Typography is loaded from Fontshare in styles/ozer-tokens.css.
 * This module only applies layout/theme classes on <html>.
 */
import { cn } from '@kit/ui/utils';

export function getFontsClassName(_theme?: string) {
  return cn({ dark: true });
}
