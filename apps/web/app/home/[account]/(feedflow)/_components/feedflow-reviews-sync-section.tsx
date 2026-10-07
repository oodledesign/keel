import {
  loadFeedflowReviews,
  loadFeedflowWebflowConnection,
} from '../../_lib/server/feedflow-account-data';
import { ModuleDataSection } from '../../_components/module-data-section';
import { FeedflowReviewsManager } from './feedflow-reviews-manager';
import { FeedflowWebflowPanel } from './feedflow-webflow-panel';

/** Reviews list plus Webflow CMS sync, scoped to the workspace or one client. */
export async function FeedflowReviewsSyncSection(props: {
  accountId: string;
  clientId: string | null;
}) {
  const [reviews, webflow] = await Promise.all([
    loadFeedflowReviews(props.accountId, props.clientId),
    loadFeedflowWebflowConnection(props.accountId, props.clientId),
  ]);

  return (
    <>
      <ModuleDataSection
        title="Reviews"
        description="Add reviews by hand or import a CSV. Google Business Profile import will land here too. Hidden reviews are never sent to Webflow."
      >
        <FeedflowReviewsManager
          accountId={props.accountId}
          clientId={props.clientId}
          reviews={reviews}
        />
      </ModuleDataSection>

      <ModuleDataSection
        title="Webflow CMS sync"
        description="Push visible reviews into a Webflow CMS collection. Edits, hidden reviews and deletions are mirrored on each sync."
      >
        <FeedflowWebflowPanel
          accountId={props.accountId}
          clientId={props.clientId}
          connection={webflow.connection}
          log={webflow.log}
        />
      </ModuleDataSection>
    </>
  );
}
