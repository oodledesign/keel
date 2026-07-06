import { cn } from '../lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../shadcn/avatar';

function normalizePictureUrl(url: string | null | undefined) {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;

  return trimmed.replace(
    /\/storage\/v1\/object\/(?!public\/)([a-z0-9_-]+)\//i,
    '/storage/v1/object/public/$1/',
  );
}

type SessionProps = {
  displayName: string | null;
  pictureUrl?: string | null;
};

type TextProps = {
  text: string;
};

type ProfileAvatarProps = (SessionProps | TextProps) & {
  className?: string;
  fallbackClassName?: string;
};

export function ProfileAvatar(props: ProfileAvatarProps) {
  const avatarClassName = cn('h-9 w-9 shrink-0 group-focus:ring-2', props.className);

  if ('text' in props) {
    return (
      <Avatar className={avatarClassName}>
        <AvatarFallback
          className={cn(
            props.fallbackClassName,
            'animate-in fade-in uppercase',
          )}
        >
          {props.text.slice(0, 1)}
        </AvatarFallback>
      </Avatar>
    );
  }

  const initials = props.displayName?.slice(0, 1);
  const pictureUrl = normalizePictureUrl(props.pictureUrl);

  return (
    <Avatar className={avatarClassName}>
      <AvatarImage src={pictureUrl} />

      <AvatarFallback
        className={cn(props.fallbackClassName, 'animate-in fade-in')}
      >
        <span suppressHydrationWarning className={'uppercase'}>
          {initials}
        </span>
      </AvatarFallback>
    </Avatar>
  );
}
