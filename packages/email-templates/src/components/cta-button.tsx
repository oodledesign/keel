import { Button } from '@react-email/components';

/** Ozer coral CTA — padded pill button for email clients. */
export function CtaButton(
  props: React.PropsWithChildren<{
    href: string;
  }>,
) {
  return (
    <Button
      href={props.href}
      style={{
        backgroundColor: '#FF5C34',
        borderRadius: '999px',
        color: '#FFFFFF',
        display: 'inline-block',
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
        fontSize: '15px',
        fontWeight: 700,
        lineHeight: '1.2',
        padding: '14px 28px',
        textAlign: 'center',
        textDecoration: 'none',
      }}
    >
      {props.children}
    </Button>
  );
}
