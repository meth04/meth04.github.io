import { getCollection, type CollectionEntry } from 'astro:content';
import { excerpt, slugify } from './text';
import { DEFAULT_LANG, type Lang } from './i18n';

export type Article = CollectionEntry<'blog'>;

/** Drafts are visible while developing and hidden from production builds. */
const includeDrafts = import.meta.env.DEV;

export async function getArticles(): Promise<Article[]> {
  const entries = await getCollection('blog', ({ data }) => includeDrafts || !data.draft);
  return entries.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export function articleUrl(entry: Article): string {
  return `/blog/${entry.id}/`;
}

/**
 * The article's summary: its own description when it has one, otherwise an
 * excerpt of the opening prose. Used by cards, search, RSS, social images and
 * the meta description, so a missing description degrades gracefully instead of
 * failing the build.
 */
export function articleSummary(article: Article, maxChars = 180): string {
  const declared = article.data.description?.trim();
  return declared && declared.length > 0 ? declared : excerpt(article.body ?? '', maxChars);
}

/* ---------------------------------------------------------------- languages */

export function inLanguage(articles: Article[], lang: Lang): Article[] {
  return articles.filter((a) => a.data.lang === lang);
}

/** How many articles exist in each language, for the archive's filter chips. */
export function languageCounts(articles: Article[]): Map<Lang, number> {
  const counts = new Map<Lang, number>();
  for (const article of articles) {
    const lang = article.data.lang;
    counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }
  return counts;
}

/** The same article written in another language, if one exists. */
export function translationOf(current: Article, all: Article[]): Article | undefined {
  const key = current.data.translationKey;
  if (!key) return undefined;
  return all.find((a) => a.id !== current.id && a.data.translationKey === key);
}

/**
 * One entry per *work*: where an article exists in several languages, keep the
 * preferred one. Used on the homepage and topic pages so that a translated
 * article is not listed twice; the archive at /blog/ still shows every entry.
 */
export function collapseTranslations(
  articles: Article[],
  preferred: Lang = DEFAULT_LANG,
): Article[] {
  const seen = new Set<string>();
  const out: Article[] = [];
  for (const article of articles) {
    const key = article.data.translationKey;
    if (!key) {
      out.push(article);
      continue;
    }
    if (seen.has(key)) continue;
    const siblings = articles.filter((a) => a.data.translationKey === key);
    const chosen = siblings.find((a) => a.data.lang === preferred) ?? siblings[0]!;
    seen.add(key);
    out.push(chosen);
  }
  return out.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export interface TopicSummary {
  slug: string;
  label: string;
  count: number;
}

/** Topics are broad subject areas; tags are finer-grained keywords. */
export function collectTopics(articles: Article[]): TopicSummary[] {
  return collect(articles.flatMap((a) => a.data.topics));
}

export function collectTags(articles: Article[]): TopicSummary[] {
  return collect(articles.flatMap((a) => a.data.tags));
}

function collect(values: string[]): TopicSummary[] {
  const map = new Map<string, TopicSummary>();
  for (const value of values) {
    const slug = slugify(value);
    if (!slug) continue;
    const existing = map.get(slug);
    if (existing) existing.count += 1;
    else map.set(slug, { slug, label: value, count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function articlesInTopic(articles: Article[], topicSlug: string): Article[] {
  return articles.filter((a) => a.data.topics.some((t) => slugify(t) === topicSlug));
}

/**
 * Related articles: score by shared topics (weight 2) then shared tags
 * (weight 1), falling back to the most recent articles so the section is never
 * empty on a site with few posts.
 */
export function relatedArticles(current: Article, all: Article[], limit = 3): Article[] {
  const topics = new Set(current.data.topics.map(slugify));
  const tags = new Set(current.data.tags.map(slugify));

  const scored = all
    // Suggestions stay in the language the reader is already reading, and never
    // point back at a translation of the current article.
    .filter(
      (a) =>
        a.id !== current.id &&
        a.data.lang === current.data.lang &&
        (!current.data.translationKey || a.data.translationKey !== current.data.translationKey),
    )
    .map((a) => {
      const topicScore = a.data.topics.filter((t) => topics.has(slugify(t))).length * 2;
      const tagScore = a.data.tags.filter((t) => tags.has(slugify(t))).length;
      return { article: a, score: topicScore + tagScore };
    })
    .sort(
      (a, b) =>
        b.score - a.score || b.article.data.pubDate.valueOf() - a.article.data.pubDate.valueOf(),
    );

  return scored.slice(0, limit).map((s) => s.article);
}

/** Newer/older neighbours in publication order, within the same language. */
export function neighbours(current: Article, all: Article[]) {
  const sameLanguage = all.filter((a) => a.data.lang === current.data.lang);
  const index = sameLanguage.findIndex((a) => a.id === current.id);
  return {
    newer: index > 0 ? sameLanguage[index - 1] : undefined,
    older: index >= 0 && index < sameLanguage.length - 1 ? sameLanguage[index + 1] : undefined,
  };
}
