import Link from 'next/link';

import Image from 'next/image';

import { Avatar, AvatarFallback, AvatarImage } from '@kit/ui/avatar';

import type { BlogPostListItem } from '~/lib/blog';

type BlogPostCardProps = {
  post: BlogPostListItem;
  preloadImage?: boolean;
};

function formatPublishedDate(value: string | null) {
  if (!value) return null;

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function normalizePictureUrl(url: string | null | undefined) {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;

  return trimmed.replace(
    /\/storage\/v1\/object\/(?!public\/)([a-z0-9_-]+)\//i,
    '/storage/v1/object/public/$1/',
  );
}

export function BlogPostCard({ post, preloadImage }: BlogPostCardProps) {
  const href = `/blog/${post.slug}`;
  const publishedLabel = formatPublishedDate(post.published_at);
  const avatarUrl = normalizePictureUrl(post.author_avatar_url);

  return (
    <article className="border-border/40 bg-card group flex flex-col overflow-hidden rounded-xl border transition-shadow hover:shadow-md">
      <Link
        href={href}
        className="bg-muted relative block aspect-[16/10] overflow-hidden"
        tabIndex={-1}
        aria-hidden
      >
        {post.featured_image_url ? (
          <Image
            src={post.featured_image_url}
            alt={post.featured_image_alt ?? post.title}
            fill
            priority={preloadImage}
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          />
        ) : (
          <div className="text-muted-foreground flex h-full items-end bg-[var(--ozer-cream-100)] p-5 dark:bg-[var(--ozer-plum-800)]">
            <span className="font-heading text-sm tracking-tight">Ozer Blog</span>
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {publishedLabel ? (
            <time dateTime={post.published_at ?? undefined}>{publishedLabel}</time>
          ) : null}
          {post.reading_time_minutes ? (
            <>
              {publishedLabel ? <span aria-hidden>·</span> : null}
              <span>{post.reading_time_minutes} min read</span>
            </>
          ) : null}
        </div>

        <h2 className="font-heading text-xl leading-snug font-semibold tracking-tight">
          <Link href={href} className="hover:text-primary transition-colors">
            {post.title}
          </Link>
        </h2>

        {post.excerpt ? (
          <p className="text-muted-foreground line-clamp-3 text-sm leading-relaxed">
            {post.excerpt}
          </p>
        ) : null}

        <div className="border-border/40 mt-auto flex items-center gap-3 border-t pt-4">
          <Avatar className="h-9 w-9">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={post.author_name} /> : null}
            <AvatarFallback className="text-xs uppercase">
              {post.author_name.slice(0, 1)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{post.author_name}</p>
            {post.primary_keyword ? (
              <p className="text-muted-foreground truncate text-xs">
                {post.primary_keyword}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
