import { buildFormThemeCss } from '~/lib/workspace-forms/form-custom-css';
import type { WorkspaceFormTheme } from '~/lib/workspace-forms/form-theme';

/**
 * Injects the per-form font, corner style and scoped custom CSS. The CSS is
 * validated (no "<", url(), @import …) so it cannot break out of the tag.
 */
export function FormThemeStyle({
  theme,
}: {
  theme: Pick<WorkspaceFormTheme, 'fontFamily' | 'cornerStyle' | 'customCss'>;
}) {
  const css = buildFormThemeCss(theme);
  if (!css) return null;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
