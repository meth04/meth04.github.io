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
