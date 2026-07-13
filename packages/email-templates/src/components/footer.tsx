import { Section, Text } from '@react-email/components';

export function EmailFooter(props: React.PropsWithChildren) {
  return (
    <Section style={{ padding: '0 32px 24px' }}>
      <Text
        style={{
          color: '#9B8590',
          fontSize: '12px',
          lineHeight: '1.5',
          margin: 0,
        }}
      >
        {props.children}
      </Text>
    </Section>
  );
}
