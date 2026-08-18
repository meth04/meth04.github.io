/** URL-safe slug: lowercase, spaces and punctuation collapsed to hyphens. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const WORDS_PER_MINUTE = 200;

/**
 * Estimate reading time from raw MDX source. JSX component tags, import
 * statements, frontmatter and math delimiters are stripped first so that the
 * estimate reflects prose rather than markup.
 */
export function readingTimeMinutes(source: string): number {
  const prose = source
    .replace(/^---[\s\S]*?---/, '')
    .replace(/^import .*$/gm, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' equation ')
    .replace(/\$[^$\n]+\$/g, ' term ')
    .replace(/[#*_>`|-]/g, ' ');
  const words = prose.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/** Plain text extracted from MDX, used for the client-side search index. */
export function toSearchText(source: string): string {
  return source
    .replace(/^---[\s\S]*?---/, '')
    .replace(/^import .*$/gm, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$([^$\n]+)\$/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_>`|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The distinct words of a text, space separated and sorted. Used as the
 * searchable body so that the index scales with vocabulary, not article length.
 */
export function vocabulary(text: string): string {
  const words = new Set(
    text
      .toLowerCase()
      // Unicode-aware: an ASCII-only split throws away every Vietnamese word.
      .split(/[^\p{L}\p{N}'’]+/u)
      .filter((word) => word.length > 1),
  );
  return [...words].sort().join(' ');
}

/**
 * First sentence-ish of an article, used wherever a summary is needed and the
 * frontmatter does not provide one. Cuts on a word boundary.
 */
export function excerpt(source: string, maxChars = 180): string {
  const text = toSearchText(source);
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > maxChars * 0.5 ? lastSpace : maxChars).trimEnd()}…`;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
