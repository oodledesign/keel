'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import {
  deleteBlogPost,
  publishBlogPost,
  unpublishBlogPost,
} from '../_actions';

export function BlogPostRowActions({
  postId,
  status,
}: {
  postId: string;
  status: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handlePublishToggle = () => {
    startTransition(async () => {
      try {
        if (status === 'published') {
          await unpublishBlogPost(postId);
          toast.success('Post unpublished');
        } else {
          await publishBlogPost(postId);
          toast.success('Post published');
        }
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to update publish status',
        );
      }
    });
  };

  const handleDelete = () => {
    if (
      !window.confirm(
        'Delete this blog post? This cannot be undone.',
      )
    ) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteBlogPost(postId);
        toast.success('Post deleted');
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to delete post');
      }
    });
  };

  return (
    <div className="flex justify-end gap-2">
      <Button asChild variant="outline" size="sm">
        <Link href={`/admin/blog/${postId}/edit`}>Edit</Link>
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={handlePublishToggle}
      >
        {status === 'published' ? 'Unpublish' : 'Publish'}
      </Button>

      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={isPending}
        onClick={handleDelete}
      >
        Delete
      </Button>
    </div>
  );
}
