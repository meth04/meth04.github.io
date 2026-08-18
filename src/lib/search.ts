/**
 * Client-side search over a static index.
 *
 * Deliberately small: token matching with field weights plus a bounded
 * edit-distance fallback so a one-character typo still finds the article.
 * No external search library and no hosted service.
 *
 * Matching is diacritic-insensitive, which matters on a bilingual site: "xac
 * suat" has to find "xác suất", because that is how people type when they are
 * in a hurry, and "gradiant" has to find "gradient".
 *
 * Two body fields are indexed. `terms` is the de-duplicated vocabulary of the
 * whole article, so a match is found however deep in the text the word appears
 * while the index stays roughly proportional to vocabulary rather than length.
 * `body` is a prefix of the readable text, used only to build snippets.
 */
export interface SearchDocument {
  id: string;
  url: string;
  /** 'en' | 'vi'; lets the search page filter by language. */
  lang: string;
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

/**
 * Lower-case a string and strip diacritics, producing exactly one output
 * character per input character. Keeping the length identical means an index
 * found in the folded string still points at the right place in the original,
 * which is what lets snippets and highlighting work on accented text.
 */
export function fold(text: string): string {
  let out = '';
  for (const ch of text.toLowerCase()) {
    const base = ch.normalize('NFD')[0] ?? ch;
    out += base === 'đ' ? 'd' : base;
  }
  return out;
}

export function tokenize(text: string): string[] {
  return fold(text)
    .split(/[^\p{L}\p{N}'’]+/u)
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
  if (fold(field).includes(term)) return 1;
  if (term.length < FUZZY_MIN_LENGTH) return 0;
  for (const word of tokenize(field)) {
    if (withinOneEdit(term, word)) return 0.6;
  }
  return 0;
}

export function search(
  documents: SearchDocument[],
  query: string,
  limit = 12,
  lang: string | 'all' = 'all',
): SearchResult[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];

  const pool = lang === 'all' ? documents : documents.filter((d) => d.lang === lang);
  const results: SearchResult[] = [];
  for (const doc of pool) {
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
  const folded = fold(body);
  let index = -1;
  for (const term of terms) {
    index = folded.indexOf(term);
    if (index >= 0) break;
  }
  if (index < 0) return doc.description;
  const start = Math.max(0, index - radius);
  const end = Math.min(body.length, index + radius);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < body.length ? '…' : '';
  return `${prefix}${body.slice(start, end).trim()}${suffix}`;
}

/**
 * Split text into runs so matches can be highlighted without innerHTML.
 * Matches are located in the folded text and sliced out of the original, so an
 * unaccented query still highlights the accented word it found.
 */
export function highlight(text: string, terms: string[]): Array<{ text: string; hit: boolean }> {
  if (terms.length === 0) return [{ text, hit: false }];
  const folded = fold(text);

  const ranges: Array<[number, number]> = [];
  for (const term of terms) {
    if (term.length === 0) continue;
    let from = folded.indexOf(term);
    while (from !== -1) {
      ranges.push([from, from + term.length]);
      from = folded.indexOf(term, from + term.length);
    }
  }
  if (ranges.length === 0) return [{ text, hit: false }];

  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([range[0], range[1]]);
  }

  const parts: Array<{ text: string; hit: boolean }> = [];
  let cursor = 0;
  for (const [from, to] of merged) {
    if (from > cursor) parts.push({ text: text.slice(cursor, from), hit: false });
    parts.push({ text: text.slice(from, to), hit: true });
    cursor = to;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), hit: false });
  return parts;
}
