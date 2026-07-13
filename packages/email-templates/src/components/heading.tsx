import { Heading } from '@react-email/components';

export function EmailHeading(props: React.PropsWithChildren) {
  return (
    <Heading
      as="h1"
      style={{
        color: '#2A1720',
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: '24px',
        fontWeight: 700,
        lineHeight: '1.3',
        margin: '0 0 8px',
      }}
    >
      {props.children}
    </Heading>
  );
}
