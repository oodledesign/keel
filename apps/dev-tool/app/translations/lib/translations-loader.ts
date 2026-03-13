import { findWorkspaceRoot } from '@kit/mcp-server/env';
import {
  createKitTranslationsDeps,
  createKitTranslationsService,
} from '@kit/mcp-server/translations';

export type Translations = {
  base_locale: string;
  locales: string[];
  namespaces: string[];
  translations: Record<string, Record<string, Record<string, string>>>;
};

export async function loadTranslations(): Promise<Translations> {
  const rootPath = findWorkspaceRoot(process.cwd());
  const service = createKitTranslationsService(
    createKitTranslationsDeps(rootPath),
  );

  return service.list();
}
