import { AdminGuard } from '@kit/admin/components/admin-guard';
import { PageBody, PageHeader } from '@kit/ui/page';

import { BlogPostForm } from '../_components/BlogPostForm';

export const metadata = {
  title: 'New blog post',
};

function AdminNewBlogPostPage() {
  return (
    <>
      <PageHeader
        title="New blog post"
        description="Create a new marketing blog post."
      />

      <PageBody>
        <BlogPostForm />
      </PageBody>
    </>
  );
}

export default AdminGuard(AdminNewBlogPostPage);
