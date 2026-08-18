import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getArticles, articleUrl } from '../lib/content';
import { SITE_TITLE, SITE_DESCRIPTION } from '../consts';

export async function GET(context: APIContext) {
  const articles = await getArticles();
  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site ?? 'https://meth04.github.io',
    items: articles.map((article) => ({
      title: article.data.title,
      description: article.data.description,
      pubDate: article.data.pubDate,
      link: articleUrl(article),
      categories: [...article.data.topics, ...article.data.tags],
    })),
    customData: '<language>en-gb</language>',
  });
}
