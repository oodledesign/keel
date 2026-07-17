import { cn } from '../../lib/utils';

interface HeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  logo?: React.ReactNode;
  navigation?: React.ReactNode;
  actions?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = function ({
  className,
  logo,
  navigation,
  actions,
  ...props
}) {
  return (
    <div
      className={cn(
        'site-header sticky top-0 z-50 w-full bg-white/95 backdrop-blur-lg dark:bg-[#121822]/95',
        className,
      )}
      {...props}
    >
      <div className="container">
        <div className="grid h-14 grid-cols-[1fr_auto] items-center md:grid-cols-3">
          <div className="justify-self-start">{logo}</div>
          <div className="hidden justify-self-center md:block">
            {navigation}
          </div>
          <div className="flex items-center justify-end gap-x-2 justify-self-end">
            {actions}
          </div>
        </div>
      </div>
    </div>
  );
};
