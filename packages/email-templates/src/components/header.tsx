import { Container, Img, Section } from '@react-email/components';

function logoUrl() {
  const origin = (
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ozer.so'
  ).replace(/\/$/, '');
  // Cache-bust so email clients pick up the optically aligned wordmark.
  return `${origin}/brand/ozer-wordmark-dark.png?v=20260826`;
}

export function EmailHeader(props: React.PropsWithChildren) {
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Ozer';

  return (
    <Container style={{ width: '100%', maxWidth: '560px' }}>
      <Section
        style={{
          backgroundColor: '#2A1720',
          borderRadius: '16px 16px 0 0',
          padding: '22px 32px',
        }}
      >
        <Img
          src={logoUrl()}
          width={120}
          height={33}
          alt={productName}
          style={{ display: 'block', border: 0 }}
        />
      </Section>
      <Section style={{ padding: '28px 32px 0' }}>{props.children}</Section>
    </Container>
  );
}
