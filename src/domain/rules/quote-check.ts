// Rule 2 helper: a quote only counts if it really appears in the saved page text.
// Normalises case, whitespace, smart quotes and dashes so formatting can't cause false rejects.

export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const MIN_QUOTE_LENGTH = 12;

export function quoteAppearsIn(quote: string, pageText: string): boolean {
  const q = normalizeForMatch(quote);
  if (q.length < MIN_QUOTE_LENGTH) return false;
  return normalizeForMatch(pageText).includes(q);
}
