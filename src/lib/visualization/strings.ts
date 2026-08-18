/**
 * Per-figure interface strings.
 *
 * Figures that appear in more than one language version of an article carry
 * their own small dictionary rather than importing the site-wide one, so each
 * figure's vocabulary stays next to the figure that uses it.
 */
export type FigureLang = 'en' | 'vi';

export function figureLang(options: Record<string, unknown>): FigureLang {
  return options.lang === 'vi' ? 'vi' : 'en';
}

export function pick<T>(lang: FigureLang, table: Record<FigureLang, T>): T {
  return table[lang];
}
