import { AdminGuard } from '@kit/admin/components/admin-guard';
import { PageBody, PageHeader } from '@kit/ui/page';

import { BlogPostForm } from '../_components/BlogPostForm';
import { loadBlogAuthorOptions } from '../_lib/load-blog-author-options';

export const metadata = {
  title: 'New blog post',
};

async function AdminNewBlogPostPage() {
  const authorOptions = await loadBlogAuthorOptions();

  return (
    <>
      <PageHeader
        title="New blog post"
        description="Create a new marketing blog post."
      />

      <PageBody>
        <BlogPostForm authorOptions={authorOptions} />
      </PageBody>
    </>
  );
}

export default AdminGuard(AdminNewBlogPostPage);
