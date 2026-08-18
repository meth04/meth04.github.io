import { getCollection, type CollectionEntry } from 'astro:content';
import { slugify } from './text';

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
    .filter((a) => a.id !== current.id)
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

/** Newer/older neighbours in publication order. */
export function neighbours(current: Article, all: Article[]) {
  const index = all.findIndex((a) => a.id === current.id);
  return {
    newer: index > 0 ? all[index - 1] : undefined,
    older: index >= 0 && index < all.length - 1 ? all[index + 1] : undefined,
  };
}
