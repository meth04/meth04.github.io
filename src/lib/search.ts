/**
 * Client-side search over a static index.
 *
 * Deliberately small: token matching with field weights plus a bounded
 * edit-distance fallback so a one-character typo still finds the article.
 * No external search library and no hosted service.
 *
 * Two body fields are indexed. `terms` is the de-duplicated vocabulary of the
 * whole article, so a match is found however deep in the text the word appears
 * while the index stays roughly proportional to vocabulary rather than length.
 * `body` is a prefix of the readable text, used only to build snippets.
 */
export interface SearchDocument {
  id: string;
  url: string;
  title: string;
  description: string;
  date: string;
  topics: string[];
  tags: string[];
  /** Opening text of the article, for snippets. */
  body: string;
  /** Every distinct word in the article, space separated. */
  terms: string;
}

export interface SearchResult {
  doc: SearchDocument;
  score: number;
  snippet: string;
}

const WEIGHTS = { title: 12, topics: 6, tags: 5, description: 4, body: 1 };
/** Words shorter than this are matched exactly; longer ones tolerate a typo. */
const FUZZY_MIN_LENGTH = 5;

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9'’]+/)
    .filter((t) => t.length > 1);
}

/** True when `a` and `b` differ by at most one insertion, deletion or substitution. */
function withinOneEdit(a: string, b: string): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (long.length - short.length > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (short.length === long.length) i++;
    j++;
  }
  return edits + (long.length - j) + (short.length - i) <= 1;
}

function fieldScore(term: string, field: string): number {
  if (field.length === 0) return 0;
  const haystack = field.toLowerCase();
  if (haystack.includes(term)) return 1;
  if (term.length < FUZZY_MIN_LENGTH) return 0;
  for (const word of tokenize(haystack)) {
    if (withinOneEdit(term, word)) return 0.6;
  }
  return 0;
}

export function search(documents: SearchDocument[], query: string, limit = 12): SearchResult[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];

  const results: SearchResult[] = [];
  for (const doc of documents) {
    let score = 0;
    let matched = 0;
    for (const term of terms) {
      const local =
        fieldScore(term, doc.title) * WEIGHTS.title +
        fieldScore(term, doc.topics.join(' ')) * WEIGHTS.topics +
        fieldScore(term, doc.tags.join(' ')) * WEIGHTS.tags +
        fieldScore(term, doc.description) * WEIGHTS.description +
        fieldScore(term, doc.terms) * WEIGHTS.body;
      if (local > 0) matched += 1;
      score += local;
    }
    // Require every term to match somewhere: an AND search is far less noisy
    // on a site with a handful of long articles.
    if (matched === terms.length && score > 0) {
      results.push({ doc, score, snippet: snippetFor(doc, terms) });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** A short body excerpt centred on the first matching term. */
function snippetFor(doc: SearchDocument, terms: string[], radius = 110): string {
  const body = doc.body;
  const lower = body.toLowerCase();
  let index = -1;
  for (const term of terms) {
    index = lower.indexOf(term);
    if (index >= 0) break;
  }
  if (index < 0) return doc.description;
  const start = Math.max(0, index - radius);
  const end = Math.min(body.length, index + radius);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < body.length ? '…' : '';
  return `${prefix}${body.slice(start, end).trim()}${suffix}`;
}

/** Split text into runs so matches can be highlighted without innerHTML. */
export function highlight(text: string, terms: string[]): Array<{ text: string; hit: boolean }> {
  if (terms.length === 0) return [{ text, hit: false }];
  const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'ig');
  return text
    .split(pattern)
    .filter((part) => part.length > 0)
    .map((part) => ({ text: part, hit: terms.includes(part.toLowerCase()) }));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
