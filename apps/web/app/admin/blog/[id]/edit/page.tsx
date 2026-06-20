import { notFound } from 'next/navigation';

import { AdminGuard } from '@kit/admin/components/admin-guard';
import { PageBody, PageHeader } from '@kit/ui/page';

import { getAdminBlogPost } from '../../_actions';
import { BlogPostForm } from '../../_components/BlogPostForm';
import { loadBlogAuthorOptions } from '../../_lib/load-blog-author-options';

export const metadata = {
  title: 'Edit blog post',
};

async function AdminEditBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [post, authorOptions] = await Promise.all([
    getAdminBlogPost(id),
    loadBlogAuthorOptions(),
  ]);

  if (!post) {
    notFound();
  }

  return (
    <>
      <PageHeader
        title="Edit blog post"
        description={post.title}
      />

      <PageBody>
        <BlogPostForm post={post} authorOptions={authorOptions} />
      </PageBody>
    </>
  );
}

export default AdminGuard(AdminEditBlogPostPage);
