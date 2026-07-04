import {
  serializeJsonLd,
  type JsonLd,
} from '~/lib/seo/schema';

type JsonLdProps = {
  data: JsonLd | JsonLd[] | null | undefined;
};

/** Server-rendered JSON-LD script tag. */
export function JsonLd({ data }: JsonLdProps) {
  if (!data) return null;
  const payload = Array.isArray(data) && data.length === 0 ? null : data;
  if (!payload) return null;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(payload) }}
    />
  );
}
