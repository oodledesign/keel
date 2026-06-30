import { redirect } from 'next/navigation';

import pathsConfig from '~/config/paths.config';

async function PersonalNewNotePage() {
  redirect(`${pathsConfig.app.personalNotes}?new=1`);
}

export default PersonalNewNotePage;
