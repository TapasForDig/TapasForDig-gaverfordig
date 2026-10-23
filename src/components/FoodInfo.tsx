// Fødevareoplysninger ved gaver i kategorien "Mad og drikke".
// Ingrediensliste og nettoindhold skal kunne ses, før gaven vælges (fjernsalg af færdigpakkede fødevarer).
export function FoodInfo({
  ingredients,
  netContent,
  contact,
  compact = false,
}: {
  ingredients: string | null;
  netContent: string | null;
  contact: { phone: string; email: string };
  compact?: boolean;
}) {
  return (
    <div className="food-info">
      <p>
        Gaven pakkes først ved bestilling. Har du spørgsmål om allergener, så kontakt Gaver For Dig på{' '}
        <a href={`tel:${contact.phone.replace(/\s/g, '')}`}>{contact.phone}</a> eller <a href={`mailto:${contact.email}`}>{contact.email}</a>.
      </p>
      {(ingredients || netContent) && (
        <details open={!compact}>
          <summary>Ingredienser og allergener</summary>
          {netContent && (
            <p>
              <b>Nettoindhold:</b> {netContent}
            </p>
          )}
          {ingredients && <p style={{ whiteSpace: 'pre-line' }}>{ingredients}</p>}
          <p className="muted">Allergener er skrevet med STORE BOGSTAVER. Holdbarhedsdato står på varen ved levering.</p>
        </details>
      )}
    </div>
  );
}
