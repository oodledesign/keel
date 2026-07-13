import { Section } from '@react-email/components';

export function EmailContent(props: React.PropsWithChildren) {
  return (
    <Section
      style={{
        padding: '8px 32px 28px',
        color: '#5A4450',
        fontSize: '15px',
        lineHeight: '1.65',
      }}
    >
      {props.children}
    </Section>
  );
}
