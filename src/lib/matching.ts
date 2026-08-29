// Deterministic label detection: most students write "Q3", "3.", "Ans 3(a)",
// "3(a)" etc. at the start of their answer. Catching these directly is far
// more reliable than asking an LLM to guess, and it's what lets us handle
// "questions answered out of order" correctly (order on the page doesn't
// matter once we can read the label).

export interface DetectedLabel {
  number: string;
  subpart: string | null;
}

const LABEL_PATTERNS: RegExp[] = [
  // "Q3(a)", "Q.3 (a)", "Question 3 a)", "Ans 3(a)", "Answer 3(a)"
  /\b(?:q(?:uestion)?|ans(?:wer)?)\.?\s*(?:no\.?)?\s*[:\-]?\s*(\d{1,3})\s*[\.\)\-:]?\s*\(?\s*([a-hA-H])?\s*\)?/i,
  // bare "3(a)" / "3. (a)" / "3 -" at the very start of the block
  /^\s*(\d{1,3})\s*[\.\)\-:]?\s*\(?\s*([a-hA-H])?\s*\)?/,
];

export function detectLabel(text: string): DetectedLabel | null {
  const head = text.slice(0, 60);
  for (const re of LABEL_PATTERNS) {
    const m = head.match(re);
    if (m && m[1]) {
      return { number: m[1], subpart: m[2] ? m[2].toLowerCase() : null };
    }
  }
  return null;
}

export function sameLabel(a: DetectedLabel | null, b: { number: string; subpart: string | null }): boolean {
  if (!a) return false;
  return a.number === b.number && (a.subpart || null) === (b.subpart || null);
}

export function labelKey(number: string, subpart: string | null): string {
  return `${number}${subpart ? `-${subpart}` : ""}`;
}
