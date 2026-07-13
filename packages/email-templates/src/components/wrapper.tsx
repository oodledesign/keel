import { Container } from '@react-email/components';

export function EmailWrapper(
  props: React.PropsWithChildren<{
    className?: string;
  }>,
) {
  return (
    <Container
      style={{
        backgroundColor: '#FBF6EC',
        margin: '0 auto',
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
        color: '#2A1720',
        width: '100%',
        padding: '28px 16px',
      }}
    >
      <Container
        style={{
          maxWidth: '560px',
          backgroundColor: '#FFFFFF',
          margin: '0 auto',
          borderRadius: '16px',
          border: '1px solid #E7DECF',
          overflow: 'hidden',
        }}
        className={props.className}
      >
        {props.children}
      </Container>
    </Container>
  );
}
