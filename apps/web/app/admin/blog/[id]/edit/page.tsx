import { notFound } from 'next/navigation';

import { AdminGuard } from '@kit/admin/components/admin-guard';
import { PageBody, PageHeader } from '@kit/ui/page';

import { getAdminBlogPost } from '../../_actions';
import { BlogPostForm } from '../../_components/BlogPostForm';

export const metadata = {
  title: 'Edit blog post',
};

async function AdminEditBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getAdminBlogPost(id);

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
        <BlogPostForm post={post} />
      </PageBody>
    </>
  );
}

export default AdminGuard(AdminEditBlogPostPage);
