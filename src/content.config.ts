import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

/**
 * Shared article schema. `notes` and `series` collections can reuse or extend
 * this later without changing the blog route.
 */
const articleSchema = z.object({
  title: z.string().max(120),
  description: z.string().min(20).max(300),
  /** Language the article is written in. Drives filtering and `<html lang>`. */
  lang: z.enum(['en', 'vi']).default('en'),
  /**
   * Shared key linking the versions of one article across languages, so each
   * can link to its translation. Two entries with the same key must not share
   * a language.
   */
  translationKey: z.string().optional(),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  tags: z.array(z.string()).default([]),
  topics: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
  featured: z.boolean().default(false),
  series: z.string().optional(),
  seriesOrder: z.number().optional(),
  hero: z
    .object({
      src: z.string(),
      alt: z.string(),
    })
    .optional(),
});

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: articleSchema,
});

export const collections = { blog };
