import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';

type SignaturesPostgrestSchemaMissingCardProps = {
  title: string;
  description: string;
  steps: readonly [string, string, string];
  footer?: React.ReactNode;
};

export function SignaturesPostgrestSchemaMissingCard({
  title,
  description,
  steps,
  footer,
}: SignaturesPostgrestSchemaMissingCardProps) {
  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center py-12">
      <Card className="max-w-lg border-white/10 bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
        <CardHeader>
          <CardTitle className="text-xl">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{description}</p>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            {steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
          {footer ? (
            <div className="pt-2">{footer}</div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export function SignaturesPostgrestSchemaRetryButton({
  label,
  onRetry,
}: {
  label: string;
  onRetry: () => void;
}) {
  return (
    <Button type="button" variant="outline" onClick={onRetry}>
      {label}
    </Button>
  );
}
