// Strukturerede data til Google (schema.org). "<" escapes, så indholdet ikke kan lukke script-tagget.
export function JsonLd({ data }: { data: object | object[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}
