import Link from 'next/link';

import { AdminGuard } from '@kit/admin/components/admin-guard';
import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { PageBody, PageHeader } from '@kit/ui/page';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';

import {
  getAdminBlogPosts,
} from './_actions';
import { BlogPostRowActions } from './_components/blog-post-row-actions';

export const metadata = {
  title: 'Blog',
};

function formatDate(value: string | null) {
  if (!value) return '—';

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

async function AdminBlogPage() {
  const posts = await getAdminBlogPosts();

  return (
    <>
      <PageHeader
        title="Blog"
        description="Manage marketing blog posts."
      >
        <Button asChild>
          <Link href="/admin/blog/new">New Post</Link>
        </Button>
      </PageHeader>

      <PageBody>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Primary keyword</TableHead>
                <TableHead>Published</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                    No blog posts yet.
                  </TableCell>
                </TableRow>
              ) : (
                posts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell className="font-medium">{post.title}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {post.slug}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          post.status === 'published' ? 'default' : 'secondary'
                        }
                      >
                        {post.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {post.primary_keyword ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(post.published_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <BlogPostRowActions
                        postId={post.id}
                        status={post.status}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </PageBody>
    </>
  );
}

export default AdminGuard(AdminBlogPage);
