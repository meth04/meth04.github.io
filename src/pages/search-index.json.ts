import type { APIRoute } from 'astro';
import { getArticles, articleUrl, articleSummary } from '../lib/content';
import { isoDate, toSearchText, vocabulary } from '../lib/text';

/**
 * Static search index, built once at build time and fetched only on /search/.
 *
 * `body` is a prefix used for snippets; `terms` is the article's whole
 * vocabulary, so a word occurring late in a long article is still findable
 * without shipping the entire text.
 */
const BODY_LIMIT = 4000;

export const GET: APIRoute = async () => {
  const articles = await getArticles();
  const documents = articles.map((article) => ({
    id: article.id,
    url: articleUrl(article),
    lang: article.data.lang,
    title: article.data.title,
    description: articleSummary(article),
    date: isoDate(article.data.pubDate),
    topics: article.data.topics,
    tags: article.data.tags,
    body: toSearchText(article.body ?? '').slice(0, BODY_LIMIT),
    terms: vocabulary(toSearchText(article.body ?? '')),
  }));

  return new Response(JSON.stringify({ documents }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
