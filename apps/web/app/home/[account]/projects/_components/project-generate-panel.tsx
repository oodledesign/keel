'use client';

import {
  MediaGeneratePanel,
  type MediaGeneratePanelProps,
} from '~/components/media/media-generate-panel';

type ProjectGeneratePanelProps = MediaGeneratePanelProps & {
  projectId: string;
};

/** Project-scoped Generate tab — delegates to the shared media generate panel. */
export function ProjectGeneratePanel(props: ProjectGeneratePanelProps) {
  return <MediaGeneratePanel {...props} />;
}
